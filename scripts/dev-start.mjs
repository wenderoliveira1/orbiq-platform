import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";

import { parsePublicEnvironment } from "../packages/config/src/index.mjs";

const windows = process.platform === "win32";
const pnpmCommand = windows ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
const dockerCommand = windows ? "docker.exe" : "docker";
const dbContainer = "supabase_db_orbiq-platform";
const phase19GMigration = resolve(
  process.cwd(),
  "supabase",
  "migrations",
  "20260826200000_data_continuity.sql",
);
const phase20IMigration = resolve(
  process.cwd(),
  "supabase",
  "migrations",
  "20260827133500_private_export_delivery.sql",
);

function pnpmArgs(args) {
  return windows ? ["/d", "/s", "/c", "pnpm", ...args] : args;
}

function section(title) {
  console.log("");
  console.log("============================================================");
  console.log(` ${title}`);
  console.log("============================================================");
}

function execute(
  command,
  args,
  { capture = false, env = process.env, input = undefined } = {},
) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: capture
      ? "pipe"
      : input === undefined
        ? "inherit"
        : ["pipe", "inherit", "inherit"],
    encoding: "utf8",
    shell: false,
    env,
    input,
  });
}

function run(name, command, args, options = {}) {
  section(name);
  const result = execute(command, args, options);

  if (result.error) {
    throw new Error(`${name}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    if (options.capture && result.stdout) process.stdout.write(result.stdout);
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${name} falhou com código ${result.status ?? "desconhecido"}.`);
  }

  return result;
}

function capture(command, args) {
  return execute(command, args, { capture: true });
}

function parseEnv(output) {
  const values = {};

  for (const rawLine of output.split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    values[match[1]] = value;
  }

  return values;
}

function portIsAvailable(port) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once("error", () => resolvePort(false));
    server.once("listening", () => server.close(() => resolvePort(true)));
    server.listen(port, "127.0.0.1");
  });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function psql(sql, { captureOutput = false } = {}) {
  return execute(
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
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    {
      capture: captureOutput,
      input: sql,
    },
  );
}

function phase19GObjectsExistInDatabase() {
  const result = psql(
    `select\n` +
      `  to_regclass('public.organization_data_exports') is not null\n` +
      `  and to_regprocedure('public.get_owned_data_governance_overview()') is not null\n` +
      `  and to_regprocedure('public.create_organization_data_export(uuid)') is not null\n` +
      `  and to_regprocedure('public.consume_organization_data_export(uuid)') is not null\n` +
      `  as ready;\n`,
    { captureOutput: true },
  );

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout;
    throw new Error(`Falha ao consultar o banco local. ${detail}`);
  }

  return /\bt\b/.test(result.stdout ?? "");
}

function phase20IObjectsExistInDatabase() {
  const result = psql(
    `select\n` +
      `  exists (\n` +
      `    select 1\n` +
      `    from storage.buckets\n` +
      `    where id = 'organization-data-exports'\n` +
      `      and public = false\n` +
      `      and file_size_limit = 57671680\n` +
      `  )\n` +
      `  and (\n` +
      `    select count(*)\n` +
      `    from pg_policies\n` +
      `    where schemaname = 'storage'\n` +
      `      and tablename = 'objects'\n` +
      `      and policyname in (\n` +
      `        'orbiq_data_exports_insert_owner',\n` +
      `        'orbiq_data_exports_select_owner',\n` +
      `        'orbiq_data_exports_delete_owner'\n` +
      `      )\n` +
      `  ) = 3\n` +
      `  as ready;\n`,
    { captureOutput: true },
  );

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout;
    throw new Error(`Falha ao consultar o Storage local. ${detail}`);
  }

  return /\bt\b/.test(result.stdout ?? "");
}

function applyPhase19GDirectly() {
  section("Aplicando schema da Fase 1.9G");
  console.log(
    "[INFO] O banco local possui lacunas antigas no histórico de migrations. " +
      "Para não reaplicar migrations antigas sobre um schema já existente, " +
      "o bootstrap instalará somente a migration da Fase 1.9G.",
  );

  const sql = readFileSync(phase19GMigration, "utf8");
  const result = psql(sql);

  if (result.error || result.status !== 0) {
    const detail =
      result.error?.message || result.stderr || result.stdout || "erro SQL desconhecido";
    throw new Error(`Falha ao aplicar a migration da Fase 1.9G. ${detail}`);
  }

  console.log("[OK] Schema da Fase 1.9G aplicado sem replay de migrations antigas");
}

function applyPhase20IDirectly() {
  section("Aplicando Storage da Fase 2.0I");
  console.log(
    "[INFO] Instalando somente o bucket privado e as policies da Fase 2.0I, " +
      "sem resetar o Supabase e sem reaplicar o histórico antigo.",
  );

  const sql = readFileSync(phase20IMigration, "utf8");
  const result = psql(sql);

  if (result.error || result.status !== 0) {
    const detail =
      result.error?.message || result.stderr || result.stdout || "erro SQL desconhecido";
    throw new Error(`Falha ao aplicar a migration da Fase 2.0I. ${detail}`);
  }

  console.log("[OK] Storage privado da Fase 2.0I aplicado sem reset destrutivo");
}

function reloadPostgrestSchema() {
  const result = psql("notify pgrst, 'reload schema';\n", { captureOutput: true });

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout;
    throw new Error(`Não foi possível recarregar o schema do PostgREST. ${detail}`);
  }
}

async function governanceRpcIsVisible(apiUrl, publicKey) {
  const response = await fetch(
    `${apiUrl}/rest/v1/rpc/get_owned_data_governance_overview`,
    {
      method: "POST",
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );

  const body = await response.text();

  return !(
    response.status === 404 &&
    /PGRST202|schema cache|Could not find the function/i.test(body)
  );
}

async function ensurePhase19G(apiUrl, publicKey) {
  section("Validando banco da Fase 1.9G");

  if (!phase19GObjectsExistInDatabase()) {
    applyPhase19GDirectly();
  } else {
    console.log("[OK] Objetos da Fase 1.9G já existem no PostgreSQL");
  }

  reloadPostgrestSchema();

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await sleep(attempt === 1 ? 800 : 1200);

    if (await governanceRpcIsVisible(apiUrl, publicKey)) {
      console.log("[OK] RPC get_owned_data_governance_overview disponível no PostgREST");
      return;
    }

    console.log(`[INFO] Atualizando schema cache do PostgREST (${attempt}/6)...`);
    reloadPostgrestSchema();
  }

  throw new Error(
    "A Fase 1.9G existe no PostgreSQL, mas o PostgREST ainda não publicou a RPC. " +
      "Reinicie o Supabase local e execute pnpm dev novamente.",
  );
}

function ensurePhase20I() {
  section("Validando Storage da Fase 2.0I");

  if (!phase20IObjectsExistInDatabase()) {
    applyPhase20IDirectly();
  } else {
    console.log("[OK] Bucket privado e policies da Fase 2.0I já estão ativos");
  }
}

async function main() {
  section("ORBIQ LOCAL DEVELOPMENT");
  console.log(`[OK] Node.js ${process.versions.node}`);
  console.log("[INFO] Inicialização segura do ambiente local.");

  let status = capture(
    pnpmCommand,
    pnpmArgs(["exec", "supabase", "status"]),
  );

  if (status.status !== 0) {
    run(
      "Supabase Start",
      pnpmCommand,
      pnpmArgs(["exec", "supabase", "start"]),
    );
    status = capture(
      pnpmCommand,
      pnpmArgs(["exec", "supabase", "status"]),
    );
  }

  if (status.error || status.status !== 0) {
    throw new Error(
      "Supabase local indisponível. Confirme que o Docker Desktop está aberto e tente novamente.",
    );
  }

  console.log("[OK] Supabase local disponível");

  const envResult = capture(
    pnpmCommand,
    pnpmArgs(["exec", "supabase", "status", "-o", "env"]),
  );

  if (envResult.error || envResult.status !== 0) {
    throw new Error(
      envResult.error?.message ||
        envResult.stderr ||
        "Falha ao ler o ambiente local do Supabase.",
    );
  }

  const values = parseEnv(envResult.stdout);
  const apiUrl = values.API_URL;
  const publicKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;

  if (!apiUrl || !publicKey) {
    throw new Error(
      "Supabase iniciou, mas API_URL/PUBLISHABLE_KEY não foram encontrados.",
    );
  }

  await ensurePhase19G(apiUrl, publicKey);
  ensurePhase20I();

  if (!(await portIsAvailable(3000))) {
    throw new Error(
      "A porta 3000 já está em uso. Encerre o servidor anterior com Ctrl+C e execute pnpm dev novamente.",
    );
  }

  const webEnv = {
    ...process.env,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
  };

  parsePublicEnvironment(webEnv);

  section("ORBIQ WEB");
  console.log(`[OK] Banco local: ${apiUrl}`);
  console.log("[OK] Contrato de ambiente público validado");
  console.log("[OK] Fase 1.9G validada");
  console.log("[OK] Fase 2.0I validada");
  console.log("[INFO] Aplicação: http://localhost:3000");
  console.log("[INFO] Use Ctrl+C para encerrar.");
  console.log("");

  const web = execute(
    pnpmCommand,
    pnpmArgs(["--filter", "web", "dev"]),
    { env: webEnv },
  );

  if (web.error) {
    throw web.error;
  }

  process.exitCode = web.status ?? 0;
}

main().catch((error) => {
  console.error("");
  console.error("[ORBIQ DEV ERROR]");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error("Nenhum reset destrutivo foi executado. O terminal permanecerá aberto.");
  process.exitCode = 1;
});