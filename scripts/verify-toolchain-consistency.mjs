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

const packageJson = JSON.parse(read("package.json"));
const nodeVersion = read(".node-version").trim();
const packageManager = String(packageJson.packageManager ?? "");
const pnpmMatch = packageManager.match(/^pnpm@(\d+\.\d+\.\d+)$/);

if (!/^\d+\.\d+\.\d+$/.test(nodeVersion)) {
  fail(`.node-version invalido: ${nodeVersion || "ausente"}`);
}

if (!pnpmMatch) {
  fail(`packageManager deve fixar pnpm em versão exata: ${packageManager || "ausente"}`);
}

const pnpmVersion = pnpmMatch[1];
const engine = String(packageJson.engines?.node ?? "");
if (!engine.includes(`>=${nodeVersion}`) || !engine.includes("<23")) {
  fail(`engines.node diverge de .node-version (${nodeVersion}): ${engine || "ausente"}`);
}

const qualityWorkflow = read(".github/workflows/quality-gate.yml");
const autoqaWorkflow = read(".github/workflows/autoqa.yml");
const dockerfile = read("Dockerfile");

for (const [name, content] of [
  ["Quality Gate", qualityWorkflow],
  ["AutoQA", autoqaWorkflow],
]) {
  if (!content.includes(`version: ${pnpmVersion}`)) {
    fail(`${name} não usa pnpm ${pnpmVersion}`);
  }
  if (!content.includes(`runtime: node@${nodeVersion}`)) {
    fail(`${name} não usa Node.js ${nodeVersion}`);
  }
}

const nodeImage = `node:${nodeVersion}-alpine`;
const nodeImageCount = dockerfile.split(nodeImage).length - 1;
if (nodeImageCount < 2) {
  fail(`Dockerfile deve usar ${nodeImage} nas imagens base e runner`);
}

if (!dockerfile.includes(`corepack prepare pnpm@${pnpmVersion} --activate`)) {
  fail(`Dockerfile não ativa pnpm ${pnpmVersion}`);
}

console.log(`[OK] Toolchain consistente: Node.js ${nodeVersion}, pnpm ${pnpmVersion}`);
