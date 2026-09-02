import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function fail(message) {
  console.error(`[FALHA] ${message}`);
  process.exit(1);
}

function requireMatch(source, pattern, description) {
  if (!pattern.test(source)) {
    fail(description);
  }
}

const packageJson = JSON.parse(read("package.json"));
const releaseInfo = read("apps/web/src/lib/release-info.ts");
const releaseRoute = read("apps/web/src/app/api/release/route.ts");
const releaseDrill = read("scripts/release-drill.mjs");

if (packageJson.scripts?.["release:drill"] !== "node scripts/release-drill.mjs") {
  fail("O script release:drill deixou de apontar para o release drill canônico.");
}

for (const field of ["channel", "commit", "release", "service", "version"]) {
  requireMatch(
    releaseInfo,
    new RegExp(`\\b${field}\\b`),
    `Metadado de release ausente: ${field}`,
  );
}

requireMatch(
  releaseInfo,
  /ORBIQ_RELEASE_SHA[\s\S]*VERCEL_GIT_COMMIT_SHA[\s\S]*GITHUB_SHA/,
  "A origem do commit da release perdeu a cadeia ORBIQ_RELEASE_SHA/VERCEL_GIT_COMMIT_SHA/GITHUB_SHA.",
);
requireMatch(
  releaseInfo,
  /SAFE_RELEASE_PATTERN\s*=\s*\/\^\[a-zA-Z0-9\._-\]\{1,64\}\$\//,
  "O identificador de release não possui a validação de caracteres esperada.",
);
requireMatch(
  releaseInfo,
  /SAFE_COMMIT_PATTERN\s*=\s*\/\^\[0-9a-f\]\{7,64\}\$\/i/,
  "O commit de release não possui a validação hexadecimal esperada.",
);

const forbiddenSecrets =
  /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|DATABASE_URL|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|CLIENT_SECRET|API_SECRET/;
if (forbiddenSecrets.test(releaseInfo)) {
  fail("Metadados públicos de release não podem referenciar credenciais privilegiadas.");
}

requireMatch(
  releaseRoute,
  /dynamic\s*=\s*["']force-dynamic["']/,
  "O endpoint de release precisa permanecer dinâmico.",
);
requireMatch(
  releaseRoute,
  /getReleaseInfo\(\)/,
  "O endpoint de release deixou de usar a fonte canônica de metadados.",
);
requireMatch(
  releaseRoute,
  /["']Cache-Control["']\s*:\s*["']no-store, max-age=0["']/,
  "O endpoint de release precisa permanecer sem cache.",
);
requireMatch(
  releaseRoute,
  /["']X-Content-Type-Options["']\s*:\s*["']nosniff["']/,
  "O endpoint de release precisa manter nosniff.",
);
requireMatch(releaseRoute, /status\s*:\s*200/, "O endpoint de release precisa responder HTTP 200.");

requireMatch(
  releaseDrill,
  /ORBIQ_RELEASE_ID:\s*releaseId/,
  "O release drill deixou de injetar um identificador rastreável.",
);
requireMatch(
  releaseDrill,
  /ORBIQ_RELEASE_SHA:\s*sha/,
  "O release drill deixou de injetar o SHA do artefato.",
);
requireMatch(
  releaseDrill,
  /readJson\(["']\/api\/release["']\)/,
  "O release drill deixou de consultar o endpoint canônico de release.",
);
requireMatch(
  releaseDrill,
  /release\.body\?\.release\s*===\s*releaseId/,
  "O release drill não confirma a identidade da release.",
);
requireMatch(
  releaseDrill,
  /release\.body\?\.commit\s*===\s*sha\.slice\(0, 12\)/,
  "O release drill não confirma o vínculo entre artefato e commit.",
);
requireMatch(
  releaseDrill,
  /release\.body\?\.channel\s*===\s*["']local["']/,
  "O release drill precisa continuar isolado no canal local.",
);

console.log("[OK] Contrato de proveniência da release verificado");
console.log("[OK] Metadados públicos, endpoint e release drill permanecem rastreáveis");
