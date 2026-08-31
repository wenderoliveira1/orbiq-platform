import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";

import { parsePublicEnvironment } from "../packages/config/src/index.mjs";

const windows = process.platform === "win32";
const pnpmCommand = windows ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
const dockerCommand = windows ? "docker.exe" : "docker";
const dbContainer = "supabase_db_orbiq-platform";
const prepareOnly = process.argv.includes("--prepare-only");

const schemaPhases = [
  {
    id: "1.9D",
    label: "visão consolidada da rede",
    migration: "20260826090000_owned_organization_overview.sql",
    probeSql:
      "select to_regprocedure('public.get_owned_organization_overview(date)') is not null as ready;",
  },
  {
    id: "1.9E",
    label: "governança da rede",
    migration: "20260826120000_network_governance.sql",
    probeSql:
      "select to_regprocedure('public.get_owned_network_activity(uuid,text,timestamptz,timestamptz,text,integer,integer)') is not null as ready;",
  },
  {
    id: "1.9F",
    label: "confiabilidade da aplicação",
    migration: "20260826170000_application_reliability.sql",
    probeSql:
      `select\n` +
      `  to_regclass('public.application_incidents') is not null\n` +
      `  and to_regprocedure('public.report_application_incident(uuid,text,text,text)') is not null\n` +
      `  and to_regprocedure('public.get_owned_application_incidents(uuid,text,text,integer,integer)') is not null\n` +
      `  and to_regprocedure('public.resolve_application_incident(uuid,text)') is not null\n` +
      `  as ready;`,
  },
  {
    id: "1.9G",
    label: "continuidade e governança de dados",
    migration: "20260826200000_data_continuity.sql",
    probeSql:
      `select\n` +
      `  to_regclass('public.organization_data_exports') is not null\n` +
      `  and to_regprocedure('public.get_owned_data_governance_overview()') is not null\n` +
      `  and to_regprocedure('public.create_organization_data_export(uuid)') is not null\n` +
      `  and to_regprocedure('public.consume_organization_data_export(uuid)') is not null\n` +
      `  as ready;`,
  },
  {
    id: "2.0I",
    label: "entrega privada de exportações",
    migration: "20260827133500_private_export_delivery.sql",
    probeSql:
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
      `  as ready;`,
  },
  {
    id: "2.0S",
    label: "limites defensivos de escrita",
    migration: "20260829105000_quote_write_bounds.sql",
    probeSql:
      `select count(*) = 12 as ready\n` +
      `from pg_constraint as constraint_row\n` +
      `inner join pg_namespace as namespace_row\n` +
      `  on namespace_row.oid = constraint_row.connamespace\n` +
      `where namespace_row.nspname = 'public'\n` +
      `  and constraint_row.conname in (\n` +
      `    'quotes_mileage_upper_bound',\n` +
      `    'quotes_notes_length_bound',\n` +
      `    'quote_services_category_length_bound',\n` +
      `    'quote_services_description_length_bound',\n` +
      `    'quote_services_labor_amount_upper_bound',\n` +
      `    'quote_items_category_length_bound',\n` +
      `    'quote_items_description_length_bound',\n` +
      `    'quote_items_quantity_upper_bound',\n` +
      `    'quote_items_unit_length_bound',\n` +
      `    'quote_items_side_length_bound',\n` +
      `    'quote_items_specification_length_bound',\n` +
      `    'quote_items_notes_length_bound'\n` +
      `  );`,
  },
].map((phase) => ({
  ...phase,
  migrationPath: resolve(
    process.cwd(),
    "supabase",
    "migrations",
    phase.migration,
  ),
}));

const requiredPostgrestRpcs = [
  {
    body: { report_month: null },
    name: "get_owned_organization_overview",
  },
  {
    body: {},
    name: "get_owned_network_activity",
  },
  {
    body: {},
    name: "get_owned_application_incidents",
  },
  {
    body: {},
    name: "get_owned_data_governance_overview",
  },
];

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
      "-X",
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

function schemaPhaseIsReady(phase) {
  const result = psql(`${phase.probeSql.trim()}\n`, { captureOutput: true });

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout;
    throw new Error(`Falha ao validar a Fase ${phase.id}. ${detail}`);
  }

  return /\bt\b/.test(result.stdout ?? "");
}

function applySchemaPhase(phase) {
  section(`Reconciliando Fase ${phase.id}`);
  console.log(
    `[INFO] Instalando ${phase.label} sem resetar o Supabase local.`,
  );

  const migration = readFileSync(phase.migrationPath, "utf8");
  const result = psql(`begin;\n${migration.trim()}\ncommit;\n`);

  if (result.error || result.status !== 0) {
    const detail =
      result.error?.message || result.stderr || result.stdout || "erro SQL desconhecido";
    throw new Error(`Falha ao aplicar a Fase ${phase.id}. ${detail}`);
  }

  console.log(`[OK] Fase ${phase.id} reconciliada de forma incremental`);
}

function reloadPostgrestSchema() {
  const result = psql("notify pgrst, 'reload schema';\n", { captureOutput: true });

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout;
    throw new Error(`Não foi possível recarregar o schema do PostgREST. ${detail}`);
  }
}

async function rpcIsVisible(apiUrl, publicKey, rpc) {
  let response;

  try {
    response = await fetch(`${apiUrl}/rest/v1/rpc/${rpc.name}`, {
      method: "POST",
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rpc.body),
    });
  } catch (error) {
    throw new Error(
      `Não foi possível consultar a RPC ${rpc.name}. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const body = await response.text();

  return !(
    response.status === 404 &&
    /PGRST202|schema cache|Could not find the function/i.test(body)
  );
}

async function missingPostgrestRpcs(apiUrl, publicKey) {
  const visibility = await Promise.all(
    requiredPostgrestRpcs.map(async (rpc) => ({
      name: rpc.name,
      visible: await rpcIsVisible(apiUrl, publicKey, rpc),
    })),
  );

  return visibility.filter((rpc) => !rpc.visible).map((rpc) => rpc.name);
}

async function ensurePostgrestSchema(apiUrl, publicKey) {
  reloadPostgrestSchema();

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await sleep(attempt === 1 ? 800 : 1200);
    const missing = await missingPostgrestRpcs(apiUrl, publicKey);

    if (missing.length === 0) {
      console.log(
        `[OK] ${requiredPostgrestRpcs.length} RPCs obrigatórias publicadas no PostgREST`,
      );
      return;
    }

    console.log(
      `[INFO] Atualizando schema cache do PostgREST (${attempt}/6): ${missing.join(", ")}`,
    );
    reloadPostgrestSchema();
  }

  const missing = await missingPostgrestRpcs(apiUrl, publicKey);
  throw new Error(
    `O PostgreSQL foi reconciliado, mas o PostgREST não publicou: ${missing.join(", ")}. ` +
      "Reinicie o Supabase local e execute pnpm prepare:local novamente.",
  );
}

async function ensureLocalSchema(apiUrl, publicKey) {
  section("VALIDANDO CONTRATOS DO BANCO LOCAL");
  const applied = [];

  for (const phase of schemaPhases) {
    if (schemaPhaseIsReady(phase)) {
      console.log(`[OK] Fase ${phase.id}: ${phase.label}`);
      continue;
    }

    applySchemaPhase(phase);
    applied.push(phase.id);

    if (!schemaPhaseIsReady(phase)) {
      throw new Error(
        `A Fase ${phase.id} terminou sem instalar todos os objetos obrigatórios.`,
      );
    }
  }

  await ensurePostgrestSchema(apiUrl, publicKey);

  if (applied.length > 0) {
    console.log(`[OK] Banco local atualizado: ${applied.join(", ")}`);
  } else {
    console.log("[OK] Banco local já estava alinhado com a aplicação");
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

  await ensureLocalSchema(apiUrl, publicKey);

  if (prepareOnly) {
    section("ORBIQ LOCAL PREPARADO");
    console.log("[OK] PostgreSQL, Storage e schema cache estão alinhados");
    console.log("[INFO] Nenhum dado local foi apagado e o servidor Web não foi iniciado.");
    return;
  }

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
  console.log("[OK] Contratos locais 1.9D–2.0S validados");
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
  process.exitCode = 1;
});
