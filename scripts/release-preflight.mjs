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
  if (!response.ok) {
    throw new Error(`${label} respondeu HTTP ${response.status}.`);
  }

  requireHeader(
    response,
    "content-type",
    (value) => value.toLowerCase().includes("application/json"),
    `${label} precisa responder JSON`,
  );

  return response.json();
}

async function checkHealth(baseUrl) {
  const response = await request(baseUrl, "/api/health");
  const body = await requireJson(response, "Health check");

  if (body?.status !== "ok") {
    throw new Error("Health check não retornou status ok.");
  }

  requireHeader(
    response,
    "cache-control",
    (value) => /no-store/i.test(value),
    "Health check não pode ser armazenado em cache",
  );
}

async function checkReady(baseUrl) {
  const response = await request(baseUrl, "/api/ready");
  const body = await requireJson(response, "Readiness");

  if (body?.status !== "ready") {
    throw new Error("Readiness não retornou status ready.");
  }

  requireHeader(
    response,
    "cache-control",
    (value) => /no-store/i.test(value),
    "Readiness não pode ser armazenado em cache",
  );
}

async function checkManifest(baseUrl) {
  const response = await request(baseUrl, "/manifest.webmanifest");
  const body = await requireJson(response, "Manifesto PWA");

  if (body?.start_url !== "/" || body?.scope !== "/") {
    throw new Error("Manifesto PWA precisa usar start_url e scope na raiz.");
  }

  if (!Array.isArray(body?.icons) || body.icons.length < 2) {
    throw new Error("Manifesto PWA não possui o conjunto mínimo de ícones.");
  }
}

async function checkServiceWorker(baseUrl) {
  const response = await request(baseUrl, "/sw.js");
  if (!response.ok) {
    throw new Error(`Service worker respondeu HTTP ${response.status}.`);
  }

  requireHeader(
    response,
    "content-type",
    (value) => /javascript|ecmascript/i.test(value),
    "Service worker precisa usar MIME JavaScript",
  );

  requireHeader(
    response,
    "cache-control",
    (value) => /no-store/i.test(value),
    "Service worker precisa ser servido sem cache HTTP persistente",
  );
}

async function checkPublicShell(baseUrl) {
  for (const path of ["/login", "/offline", "/instalar"]) {
    const response = await request(baseUrl, path);
    if (!response.ok) {
      throw new Error(`${path} respondeu HTTP ${response.status}.`);
    }

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
  const environment = parsePublicEnvironment(process.env);
  const baseUrl = normalizeBaseUrl(environment.appUrl);

  console.log("============================================================");
  console.log(" ORBIQ RELEASE PREFLIGHT — FASE 2.0J");
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
