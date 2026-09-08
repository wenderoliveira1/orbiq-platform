import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const windows = process.platform === "win32";
const pnpmCommand = windows ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
const dockerCommand = windows ? "docker.exe" : "docker";
const dbContainer = "supabase_db_orbiq-platform";

const migrations = [
  {
    id: "ATENDIMENTO-01",
    file: "20260905123000_orbiq_service_catalog.sql",
    probe: "select to_regclass('public.service_catalog') is not null and to_regprocedure('public.save_service_catalog(uuid,text,text,numeric)') is not null as ready;",
  },
  {
    id: "ATENDIMENTO-02",
    file: "20260908103000_orbiq_customer_identity_uppercase_quote_fix.sql",
    probe: "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'customer_number') and to_regprocedure('public.create_quote_v2(uuid,uuid,uuid,text,integer,text,jsonb,jsonb)') is not null as ready;",
  },
  {
    id: "ATENDIMENTO-03",
    file: "20260908104500_orbiq_service_part_defaults.sql",
    probe: "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'service_catalog' and column_name = 'requires_part') as ready;",
  },
];

function args(list) {
  return windows ? ["/d", "/s", "/c", "pnpm", ...list] : list;
}

function run(command, commandArgs, input) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    encoding: "utf8",
    shell: false,
    input,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Comando falhou com código ${result.status ?? "desconhecido"}.`);
  }
  return result;
}

function capture(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
  });
  if (result.error) throw result.error;
  return result;
}

function psql(sql) {
  return run(
    dockerCommand,
    [
      "exec",
      "-i",
      dbContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    sql,
  );
}

function probe(sql) {
  const result = capture(
    dockerCommand,
    [
      "exec",
      "-i",
      dbContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
  );
  const probeResult = spawnSync(
    dockerCommand,
    [
      "exec",
      "-i",
      dbContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    { cwd: process.cwd(), input: `${sql.trim()}\n`, encoding: "utf8", shell: false, stdio: "pipe" },
  );
  if (probeResult.error || probeResult.status !== 0) throw new Error(probeResult.error?.message || probeResult.stderr || "Falha ao validar o schema local.");
  return /\btrue\b/i.test(probeResult.stdout ?? "");
}

function waitForLocalSupabase() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const status = capture(pnpmCommand, args(["exec", "supabase", "status"]));
    if (status.status === 0) return;
    run(pnpmCommand, args(["exec", "supabase", "start"]));
  }
  throw new Error("Supabase local não iniciou. Verifique se o Docker Desktop está aberto.");
}

function applyPendingMigrations() {
  for (const migration of migrations) {
    if (probe(migration.probe)) {
      console.log(`[OK] ${migration.id}: ${migration.file}`);
      continue;
    }

    const migrationPath = resolve(process.cwd(), "supabase", "migrations", migration.file);
    const sql = readFileSync(migrationPath, "utf8");
    console.log(`[INFO] Aplicando ${migration.file} no PostgreSQL local...`);
    psql(`begin;\n${sql.trim()}\ncommit;\n`);

    if (!probe(migration.probe)) {
      throw new Error(`A migration ${migration.file} foi executada, mas a validação falhou.`);
    }
    console.log(`[OK] ${migration.id} aplicada.`);
  }

  psql("notify pgrst, 'reload schema';\n");
}

function parseEnv(output) {
  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^\"|\"$/g, "");
  }
  return env;
}

function startWeb() {
  const status = capture(pnpmCommand, args(["exec", "supabase", "status", "-o", "env"]));
  if (status.status !== 0) throw new Error(status.stderr || "Não foi possível obter o ambiente do Supabase local.");
  const values = parseEnv(status.stdout ?? "");
  const apiUrl = values.API_URL;
  const publicKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  if (!apiUrl || !publicKey) throw new Error("Supabase local iniciou, mas API_URL/PUBLISHABLE_KEY não foram encontrados.");

  console.log(`[OK] Banco local: ${apiUrl}`);
  console.log("[OK] Schema de atendimento/orçamento validado");
  console.log("[INFO] Aplicação: http://localhost:3000");

  run(
    pnpmCommand,
    args(["--filter", "web", "dev"]),
    undefined,
  );
}

function main() {
  console.log("============================================================");
  console.log(" ORBIQ LIVE — DOCKER + SUPABASE LOCAL");
  console.log("============================================================");
  waitForLocalSupabase();
  applyPendingMigrations();
  startWeb();
}

main();
