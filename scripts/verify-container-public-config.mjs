import { readFile } from "node:fs/promises";

const dockerfile = await readFile("Dockerfile", "utf8");
const builderMarker = "FROM base AS builder";
const runnerMarker = "FROM node:22.23.2-alpine AS runner";
const builderStart = dockerfile.indexOf(builderMarker);
const runnerStart = dockerfile.indexOf(runnerMarker);

if (builderStart === -1 || runnerStart === -1 || builderStart >= runnerStart) {
  throw new Error("Dockerfile: builder/runner configuration stages changed");
}

const builderStage = dockerfile.slice(builderStart, runnerStart);
const runnerStage = dockerfile.slice(runnerStart);
const publicVariables = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

const requiredArgumentLines = [
  "ARG NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000",
  "ARG NEXT_PUBLIC_SUPABASE_URL",
  "ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

const requiredEnvironmentLines = [
  'ENV NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL"',
  'ENV NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"',
  'ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"',
];

for (const [stageName, stage] of [
  ["builder", builderStage],
  ["runner", runnerStage],
]) {
  for (const line of [...requiredArgumentLines, ...requiredEnvironmentLines]) {
    if (!stage.includes(line)) {
      throw new Error(
        `Dockerfile: ${stageName} public configuration contract changed: ${line}`,
      );
    }
  }
}

const argumentEntries = [...dockerfile.matchAll(/^ARG\s+([A-Z0-9_]+)(?:=(.*))?$/gm)];
if (argumentEntries.length !== publicVariables.length * 2) {
  throw new Error("Dockerfile: unexpected build argument count");
}

for (const entry of argumentEntries) {
  if (!publicVariables.includes(entry[1])) {
    throw new Error(`Dockerfile: unapproved build argument: ${entry[1]}`);
  }
}

const allowedEnvironmentVariables = new Set([
  "PNPM_HOME",
  "PATH",
  "HOSTNAME",
  "NODE_ENV",
  "PORT",
  ...publicVariables,
]);

for (const match of dockerfile.matchAll(/^ENV\s+([A-Z0-9_]+)=/gm)) {
  if (!allowedEnvironmentVariables.has(match[1])) {
    throw new Error(`Dockerfile: unapproved environment variable: ${match[1]}`);
  }
}

for (const match of dockerfile.matchAll(/^(?:ARG|ENV)\s+([A-Z0-9_]+)/gm)) {
  const name = match[1];
  if (name.startsWith("NEXT_PUBLIC_") && !publicVariables.includes(name)) {
    throw new Error(`Dockerfile: uncontracted public variable: ${name}`);
  }
}

if (/NEXT_PUBLIC_SUPABASE_(?:SERVICE_ROLE|SECRET|ANON_KEY)/i.test(dockerfile)) {
  throw new Error(
    "Dockerfile: only the Supabase publishable key is allowed in public configuration",
  );
}

if (/^(?:ARG|ENV)\s+[^\n]*(?:eyJ[a-zA-Z0-9_-]{16,}|sk_[a-zA-Z0-9_-]{12,})/m.test(dockerfile)) {
  throw new Error("Dockerfile: hardcoded credential-like value detected");
}

console.log("Container public configuration contract verified.");
