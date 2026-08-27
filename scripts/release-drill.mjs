import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

import { parsePublicEnvironment } from "../packages/config/src/index.mjs";

const root = process.cwd();
const windows = process.platform === "win32";
const pnpmCommand = windows ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
const port = Number(process.env.ORBIQ_DRILL_PORT ?? "3100");
const baseUrl = `http://127.0.0.1:${port}`;

function pnpmArgs(args) {
  return windows ? ["/d", "/s", "/c", "pnpm", ...args] : args;
}

function section(title) {
  console.log("");
  console.log("============================================================");
  console.log(` ${title}`);
  console.log("============================================================");
}

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: options.capture ? "pipe" : "inherit",
    env: options.env ?? process.env,
  });
}

function run(title, command, args, options = {}) {
  section(title);
  const result = execute(command, args, options);

  if (result.error) throw new Error(`${title}: ${result.error.message}`);
  if (result.status !== 0) {
    if (options.capture && result.stdout) process.stdout.write(result.stdout);
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${title} falhou com código ${result.status ?? "desconhecido"}.`);
  }

  console.log(`[OK] ${title}`);
  return result.stdout ?? "";
}

function parseEnv(output) {
  const values = {};
  for (const rawLine of output.split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function supabaseEnvironment() {
  let status = execute(
    pnpmCommand,
    pnpmArgs(["exec", "supabase", "status", "-o", "env"]),
    { capture: true },
  );

  if (status.error || status.status !== 0) {
    run("Supabase Start", pnpmCommand, pnpmArgs(["exec", "supabase", "start"]));
    status = execute(
      pnpmCommand,
      pnpmArgs(["exec", "supabase", "status", "-o", "env"]),
      { capture: true },
    );
  }

  if (status.error || status.status !== 0) {
    throw new Error(
      "Supabase local indisponível. Confirme que o Docker Desktop está aberto e tente novamente.",
    );
  }

  return parseEnv(status.stdout ?? "");
}

function resolveStandaloneServer() {
  const standaloneRoot = resolve(root, "apps", "web", ".next", "standalone");
  const nested = resolve(standaloneRoot, "apps", "web", "server.js");
  const flat = resolve(standaloneRoot, "server.js");
  if (existsSync(nested)) return nested;
  if (existsSync(flat)) return flat;
  throw new Error("server.js standalone não foi encontrado após o build.");
}

async function waitForServer(timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // O processo ainda está subindo.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`O artefato não ficou saudável em ${timeoutMs / 1000}s.`);
}

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} retornou HTTP ${response.status}.`);
  return { body, headers: response.headers };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill("SIGTERM");
  const exited = await new Promise((resolveExit) => {
    const timeout = setTimeout(() => resolveExit(false), 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveExit(true);
    });
  });

  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

async function main() {
  section("ORBIQ RELEASE DRILL");
  console.log("[INFO] Verificação local do artefato standalone usado na preparação Web.");
  console.log("[INFO] Nenhum deploy externo ou reset destrutivo será executado.");

  const values = supabaseEnvironment();
  const apiUrl = values.API_URL;
  const publicKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  assert(apiUrl && publicKey, "API_URL/PUBLISHABLE_KEY do Supabase local não foram encontrados.");

  const sha = run("Git release SHA", "git", ["rev-parse", "HEAD"], { capture: true }).trim();
  assert(/^[0-9a-f]{40}$/i.test(sha), "Não foi possível identificar o commit atual.");

  const releaseId = `orbiq-drill-${sha.slice(0, 12).toLowerCase()}`;
  const env = {
    ...process.env,
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
    ORBIQ_RELEASE_ID: releaseId,
    ORBIQ_RELEASE_SHA: sha,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
  };

  parsePublicEnvironment(env);
  console.log("[OK] Contrato público de ambiente validado");

  run("Next.js production build", pnpmCommand, pnpmArgs(["build:web"]), { env });
  run("Preparar artefato standalone", process.execPath, ["scripts/standalone.mjs"], { env });

  const serverFile = resolveStandaloneServer();
  section("Subindo artefato de release");
  console.log(`[INFO] ${baseUrl}`);

  const child = spawn(process.execPath, [serverFile], {
    cwd: dirname(serverFile),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForServer();
    const health = await readJson("/api/health");
    const ready = await readJson("/api/ready");
    const release = await readJson("/api/release");

    assert(health.body?.status === "healthy", "Health check não retornou healthy.");
    assert(ready.body?.status === "ready", "Readiness não retornou ready.");
    assert(release.body?.service === "orbiq-web", "Release service inválido.");
    assert(release.body?.release === releaseId, "Release ID do artefato não corresponde ao drill.");
    assert(release.body?.commit === sha.slice(0, 12).toLowerCase(), "Commit publicado não corresponde ao HEAD.");
    assert(release.body?.channel === "local", "Canal do drill deve permanecer local.");
    assert(release.headers.get("cache-control")?.includes("no-store"), "Endpoint de release precisa permanecer sem cache.");

    section("ORBIQ RELEASE DRILL APROVADO");
    console.log(`[OK] health: ${health.body.status}`);
    console.log(`[OK] ready: ${ready.body.status}`);
    console.log(`[OK] release: ${release.body.release}`);
    console.log(`[OK] commit: ${release.body.commit}`);
    console.log("[OK] Artefato standalone verificável e rastreável");
  } finally {
    await stopChild(child);
  }

  if (stderr.trim()) {
    console.log("[INFO] O servidor emitiu mensagens em stderr durante o encerramento; o drill já foi validado.");
  }
}

main().catch((error) => {
  console.error("");
  console.error("[ORBIQ RELEASE DRILL ERROR]");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error("Nenhum deploy externo ou reset destrutivo foi executado.");
  process.exitCode = 1;
});
