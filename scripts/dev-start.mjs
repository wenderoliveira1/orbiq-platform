import { spawnSync } from "node:child_process";
import net from "node:net";

const windows = process.platform === "win32";
const dbContainer = "supabase_db_orbiq-platform";

function section(title) {
  console.log("");
  console.log("============================================================");
  console.log(` ${title}`);
  console.log("============================================================");
}

function execute(command, args, { capture = false, env = process.env } = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf8",
    shell: windows,
    env,
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
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reloadPostgrestSchema() {
  const result = capture("docker", [
    "exec",
    dbContainer,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "notify pgrst, 'reload schema';",
  ]);

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout;
    throw new Error(
      `Não foi possível solicitar reload do schema do PostgREST. ${detail}`,
    );
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

async function ensureGovernanceRpc(apiUrl, publicKey) {
  section("Validando RPCs da Fase 1.9G");

  reloadPostgrestSchema();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await sleep(attempt === 1 ? 700 : 1200);

    if (await governanceRpcIsVisible(apiUrl, publicKey)) {
      console.log("[OK] RPC get_owned_data_governance_overview visível no PostgREST");
      return;
    }

    console.log(`[INFO] Aguardando atualização do schema cache (${attempt}/5)...`);
    reloadPostgrestSchema();
  }

  throw new Error(
    "O banco recebeu as migrations, mas o PostgREST ainda não expôs " +
      "get_owned_data_governance_overview. Execute `pnpm exec supabase stop`, " +
      "depois `pnpm exec supabase start` e rode `pnpm dev` novamente.",
  );
}

async function main() {
  section("ORBIQ LOCAL DEVELOPMENT");

  console.log(`[OK] Node.js ${process.versions.node}`);
  console.log("[INFO] Preparando Supabase, migrations e schema cache antes do Next.js.");

  let status = capture("pnpm", ["exec", "supabase", "status"]);

  if (status.status !== 0) {
    run("Supabase Start", "pnpm", ["exec", "supabase", "start"]);
    status = capture("pnpm", ["exec", "supabase", "status"]);
  }

  if (status.error || status.status !== 0) {
    throw new Error(
      "Supabase local indisponível. Confirme que o Docker Desktop está aberto e tente novamente.",
    );
  }

  console.log("[OK] Supabase local disponível");

  run("Sincronizando migrations locais", "pnpm", [
    "exec",
    "supabase",
    "migration",
    "up",
    "--local",
  ]);

  const envResult = capture("pnpm", ["exec", "supabase", "status", "-o", "env"]);
  if (envResult.error || envResult.status !== 0) {
    throw new Error(
      envResult.error?.message || envResult.stderr || "Falha ao ler o ambiente local do Supabase.",
    );
  }

  const values = parseEnv(envResult.stdout);
  const apiUrl = values.API_URL;
  const publicKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;

  if (!apiUrl || !publicKey) {
    throw new Error(
      "Supabase iniciou, mas API_URL/PUBLISHABLE_KEY não foram encontrados em `supabase status -o env`.",
    );
  }

  await ensureGovernanceRpc(apiUrl, publicKey);

  if (!(await portIsAvailable(3000))) {
    throw new Error(
      "A porta 3000 já está em uso. Encerre o servidor anterior com Ctrl+C " +
        "(ou finalize o processo que ocupa a porta) e execute `pnpm dev` novamente.",
    );
  }

  const webEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
  };

  section("ORBIQ WEB");
  console.log(`[OK] Banco sincronizado em ${apiUrl}`);
  console.log("[OK] RPCs da Fase 1.9G validadas");
  console.log("[INFO] Aplicação: http://localhost:3000");
  console.log("[INFO] Use Ctrl+C para encerrar o servidor.");
  console.log("");

  const web = execute("pnpm", ["--filter", "web", "dev"], { env: webEnv });

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
  console.error("O terminal do VS Code permanecerá aberto. Corrija o item acima e execute `pnpm dev` novamente.");
  process.exitCode = 1;
});
