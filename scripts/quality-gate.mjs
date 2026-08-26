import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const windows = process.platform === "win32";

function section(name) {
  console.log("");
  console.log("============================================================");
  console.log(` ${name}`);
  console.log("============================================================");
}

function execute(command, args, { capture = false, env = process.env } = {}) {
  return spawnSync(command, args, {
    cwd: root,
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
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    if (options.capture && result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (options.capture && result.stderr) {
      process.stderr.write(result.stderr);
    }

    console.error("");
    console.error(`[FALHA] ${name}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
  console.log(`[OK] ${name}`);
  return result.stdout ?? "";
}

function capture(command, args) {
  const result = execute(command, args, { capture: true });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

function normalize(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trimEnd();
}

section("ORBIQ QUALITY GATE");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
  console.error(`Node.js invalido: ${process.versions.node}`);
  process.exit(1);
}
console.log(`[OK] Node.js ${process.versions.node}`);

const tracked = capture("git", ["ls-files"]);
if (tracked.error || tracked.status !== 0) {
  console.error(tracked.error?.message ?? tracked.stderr);
  process.exit(1);
}

const envFiles = tracked.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => {
    const name = file.replace(/\\/g, "/").split("/").pop();
    return name === ".env" || name?.startsWith(".env.");
  });

if (envFiles.length > 0) {
  console.error("Arquivos .env versionados:");
  for (const file of envFiles) {
    console.error(` - ${file}`);
  }
  process.exit(1);
}
console.log("[OK] Nenhum .env versionado");

const migrationsPath = resolve(root, "supabase", "migrations");
if (!existsSync(migrationsPath)) {
  console.error("Pasta de migrations ausente.");
  process.exit(1);
}

const migrations = readdirSync(migrationsPath).filter((file) =>
  file.endsWith(".sql"),
);

if (migrations.length === 0) {
  console.error("Nenhuma migration encontrada.");
  process.exit(1);
}

const invalidMigrations = migrations.filter(
  (file) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(file),
);

if (invalidMigrations.length > 0) {
  console.error("Nome de migration invalido:");
  for (const file of invalidMigrations) {
    console.error(` - ${file}`);
  }
  process.exit(1);
}
console.log(`[OK] ${migrations.length} migrations`);

run("ESLint - zero warnings", "pnpm", [
  "--filter",
  "web",
  "exec",
  "eslint",
  ".",
  "--max-warnings=0",
]);

run("TypeScript", "pnpm", [
  "--filter",
  "web",
  "exec",
  "tsc",
  "--noEmit",
]);

let supabaseStatus = capture("pnpm", ["exec", "supabase", "status"]);
if (supabaseStatus.status !== 0) {
  console.log("Supabase desligado. Iniciando...");
  run("Supabase Start", "pnpm", ["exec", "supabase", "start"]);
  supabaseStatus = capture("pnpm", ["exec", "supabase", "status"]);
}

if (supabaseStatus.error || supabaseStatus.status !== 0) {
  console.error("Supabase local indisponivel.");
  console.error(supabaseStatus.error?.message ?? supabaseStatus.stderr);
  process.exit(1);
}
console.log("[OK] Supabase local");

// O Supabase CLI usa --fail-on=none por padrão. Em CI precisamos que
// qualquer erro detectado pelo plpgsql_check encerre o gate com status != 0.
run("PostgreSQL / Supabase Lint", "pnpm", [
  "exec",
  "supabase",
  "db",
  "lint",
  "--local",
  "--fail-on",
  "error",
]);

const generatedTypes = run(
  "Gerando Database Types",
  "pnpm",
  [
    "exec",
    "supabase",
    "gen",
    "types",
    "--lang",
    "typescript",
    "--local",
    "--schema",
    "public",
  ],
  { capture: true },
);

const committedTypes = readFileSync(
  resolve(root, "packages", "types", "src", "database.types.ts"),
  "utf8",
);

if (normalize(generatedTypes) !== normalize(committedTypes)) {
  const generatedTypesPath = resolve(root, ".database.types.generated.ts");
  writeFileSync(generatedTypesPath, generatedTypes, "utf8");

  const typeDiff = capture("git", [
    "diff",
    "--no-index",
    "--",
    "packages/types/src/database.types.ts",
    ".database.types.generated.ts",
  ]);

  console.error("");
  console.error("DATABASE TYPES DESATUALIZADOS.");
  console.error("O banco local e database.types.ts nao correspondem.");
  process.stderr.write(typeDiff.stdout || typeDiff.stderr);
  unlinkSync(generatedTypesPath);
  process.exit(1);
}
console.log("[OK] Database Types sincronizados");

const envOutput = capture("pnpm", ["exec", "supabase", "status", "-o", "env"]);
const buildEnv = { ...process.env };

if (envOutput.status === 0) {
  const values = {};

  for (const rawLine of envOutput.stdout.split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }

  if (values.API_URL) {
    buildEnv.NEXT_PUBLIC_SUPABASE_URL = values.API_URL;
  }

  const publicKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  if (publicKey) {
    buildEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publicKey;
    buildEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = publicKey;
  }
}

run("Next.js Production Build", "pnpm", ["--filter", "web", "build"], {
  env: buildEnv,
});

section("ORBIQ QUALITY GATE APROVADO");
console.log("");
console.log("[OK] Secrets");
console.log("[OK] Migrations");
console.log("[OK] ESLint");
console.log("[OK] TypeScript");
console.log("[OK] Supabase");
console.log("[OK] PostgreSQL Lint");
console.log("[OK] Database Types");
console.log("[OK] Next.js Build");
