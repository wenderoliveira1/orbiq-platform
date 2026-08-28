import { spawnSync } from "node:child_process";
import process from "node:process";

import { parsePublicEnvironment } from "../packages/config/src/index.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const REQUEST_TIMEOUT_MS = 8_000;

function fail(message) {
  console.error(`[FALHA] ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function isLocal(url) {
  return LOCAL_HOSTS.has(url.hostname);
}

function parseEnvOutput(output) {
  const values = {};

  for (const rawLine of String(output ?? "").split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[match[1]] = value;
  }

  return values;
}

function resolveEnvironment() {
  const required = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ];

  if (required.every((name) => process.env[name]?.trim())) {
    return parsePublicEnvironment(process.env);
  }

  const windows = process.platform === "win32";
  const command = windows ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
  const args = windows
    ? ["/d", "/s", "/c", "pnpm", "exec", "supabase", "status", "-o", "env"]
    : ["exec", "supabase", "status", "-o", "env"];

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    env: process.env,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      "Configuração pública ausente e o Supabase local não pôde ser consultado. Inicie o ambiente local e tente novamente.",
    );
  }

  const local = parseEnvOutput(result.stdout);
  const publicKey = local.PUBLISHABLE_KEY ?? local.ANON_KEY;

  if (!local.API_URL || !publicKey) {
    throw new Error("O Supabase local está ativo, mas API_URL/PUBLISHABLE_KEY não foram encontrados.");
  }

  return parsePublicEnvironment({
    ...process.env,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  });
}

async function request(baseUrl, path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(new URL(path, baseUrl), {
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function requireHeader(response, name, predicate, description) {
  const value = response.headers.get(name) ?? "";
  if (!predicate(value)) {
    throw new Error(`${description}. Cabeçalho ${name} recebido: ${value || "ausente"}`);
  }
}

async function requireJson(response, label) {
  if (!response.ok) throw new Error(`${label} respondeu HTTP ${response.status}.`);

  requireHeader(
    response,
    "content-type",
    (value) => /application\/json|\+json/i.test(value),
    `${label} precisa responder um tipo JSON`,
  );

  return response.json();
}

function requireNoStore(response, label) {
  requireHeader(
    response,
    "cache-control",
    (value) => /no-store/i.test(value),
    `${label} não pode ser armazenado em cache`,
  );
}

async function checkHealth(baseUrl) {
  const response = await request(baseUrl, "/api/health");
  const body = await requireJson(response, "Health check");
  if (body?.status !== "healthy" || body?.service !== "orbiq-web") {
    throw new Error("Health check não retornou o contrato saudável do Orbiq Web.");
  }
  requireNoStore(response, "Health check");
}

async function checkReady(baseUrl) {
  const response = await request(baseUrl, "/api/ready");
  const body = await requireJson(response, "Readiness");
  if (body?.status !== "ready" || body?.service !== "orbiq-web") {
    throw new Error("Readiness não retornou o contrato pronto do Orbiq Web.");
  }
  requireNoStore(response, "Readiness");
}

async function checkRelease(baseUrl) {
  const response = await request(baseUrl, "/api/release");
  const body = await requireJson(response, "Release");
  if (body?.service !== "orbiq-web") throw new Error("Identidade de release inválida.");
  if (typeof body?.version !== "string" || !/^\d+\.\d+\.\d+/.test(body.version)) {
    throw new Error("Versão da release ausente ou inválida.");
  }
  if (typeof body?.release !== "string" || body.release.length === 0) {
    throw new Error("Identificador da release ausente.");
  }
  if (!["local", "ci", "preview", "production"].includes(body?.channel)) {
    throw new Error("Canal da release inválido.");
  }
  requireNoStore(response, "Release");
}

async function checkManifest(baseUrl) {
  const response = await request(baseUrl, "/manifest.webmanifest");
  const body = await requireJson(response, "Manifesto PWA");

  if (body?.start_url !== "/dashboard" || body?.scope !== "/" || body?.id !== "/dashboard") {
    throw new Error("Manifesto PWA precisa iniciar no dashboard, manter scope raiz e identidade estável.");
  }
  if (body?.display !== "standalone") {
    throw new Error("Manifesto PWA precisa operar em modo standalone.");
  }
  if (!Array.isArray(body?.icons) || body.icons.length < 2) {
    throw new Error("Manifesto PWA não possui o conjunto mínimo de ícones.");
  }
}

async function checkServiceWorker(baseUrl) {
  const response = await request(baseUrl, "/sw.js");
  if (!response.ok) throw new Error(`Service worker respondeu HTTP ${response.status}.`);

  requireHeader(
    response,
    "content-type",
    (value) => /javascript|ecmascript/i.test(value),
    "Service worker precisa usar MIME JavaScript",
  );
  requireNoStore(response, "Service worker");
}

async function checkPublicShell(baseUrl) {
  for (const path of ["/login", "/offline", "/instalar"]) {
    const response = await request(baseUrl, path);
    if (!response.ok) throw new Error(`${path} respondeu HTTP ${response.status}.`);

    requireHeader(
      response,
      "x-content-type-options",
      (value) => value.toLowerCase() === "nosniff",
      `${path} precisa bloquear MIME sniffing`,
    );
    requireHeader(
      response,
      "referrer-policy",
      (value) => value.length > 0,
      `${path} precisa definir Referrer-Policy`,
    );
  }
}

async function main() {
  const environment = resolveEnvironment();
  const baseUrl = normalizeBaseUrl(environment.appUrl);

  console.log("============================================================");
  console.log(" ORBIQ PUBLICATION PREFLIGHT — FASE 2.0L");
  console.log("============================================================");
  console.log(`Destino: ${baseUrl.origin}`);
  console.log(`Modo: ${isLocal(baseUrl) ? "local" : "externo"}`);
  console.log("");

  if (!isLocal(baseUrl) && baseUrl.protocol !== "https:") {
    throw new Error("Ambiente externo precisa usar HTTPS antes da publicação.");
  }

  const checks = [
    ["Health check", checkHealth],
    ["Readiness", checkReady],
    ["Identidade de release", checkRelease],
    ["Manifesto PWA", checkManifest],
    ["Service worker", checkServiceWorker],
    ["Shell público e headers", checkPublicShell],
  ];

  for (const [label, run] of checks) {
    await run(baseUrl);
    ok(label);
  }

  console.log("");
  console.log("[APROVADO] O artefato Web passou pelo preflight de publicação.");
  console.log("Nenhuma chave, token, usuário ou dado de oficina foi exibido.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
