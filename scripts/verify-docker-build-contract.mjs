import { readFile } from "node:fs/promises";

const dockerfile = await readFile("Dockerfile", "utf8");

const orderedContracts = [
  "# syntax=docker/dockerfile:1.7",
  "FROM node:22.23.2-alpine AS base",
  "RUN corepack enable && corepack prepare pnpm@11.22.0 --activate",
  "FROM base AS dependencies",
  "RUN pnpm install --frozen-lockfile",
  "FROM base AS builder",
  "RUN pnpm build:web && pnpm prepare:standalone",
  "FROM node:22.23.2-alpine AS runner",
];

let previousPosition = -1;
for (const contract of orderedContracts) {
  const position = dockerfile.indexOf(contract);
  if (position === -1) {
    throw new Error(`Dockerfile: missing reproducible build contract: ${contract}`);
  }
  if (position <= previousPosition) {
    throw new Error(`Dockerfile: build contract is out of order: ${contract}`);
  }
  previousPosition = position;
}

const dependenciesStart = dockerfile.indexOf("FROM base AS dependencies");
const builderStart = dockerfile.indexOf("FROM base AS builder");
const runnerStart = dockerfile.indexOf(
  "FROM node:22.23.2-alpine AS runner",
);
const dependenciesStage = dockerfile.slice(dependenciesStart, builderStart);
const builderStage = dockerfile.slice(builderStart, runnerStart);
const runnerStage = dockerfile.slice(runnerStart);

const dependencyManifestCopies = [
  "COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./",
  "COPY apps/web/package.json apps/web/package.json",
  "COPY packages/config/package.json packages/config/package.json",
  "COPY packages/types/package.json packages/types/package.json",
  "COPY packages/validation/package.json packages/validation/package.json",
];

for (const copy of dependencyManifestCopies) {
  if (!dependenciesStage.includes(copy)) {
    throw new Error(`Dockerfile: dependency stage must preserve manifest copy: ${copy}`);
  }
}

const installCommands = dockerfile.match(/^RUN\s+pnpm\s+install\b.*$/gm) ?? [];
if (
  installCommands.length !== 1 ||
  installCommands[0] !== "RUN pnpm install --frozen-lockfile"
) {
  throw new Error(
    "Dockerfile: dependencies must be installed exactly once with --frozen-lockfile",
  );
}

const builderContracts = [
  "COPY --from=dependencies /app/node_modules ./node_modules",
  "COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules",
  "COPY . .",
  "RUN pnpm build:web && pnpm prepare:standalone",
];

for (const contract of builderContracts) {
  if (!builderStage.includes(contract)) {
    throw new Error(`Dockerfile: builder stage contract changed: ${contract}`);
  }
}

if (/\b(?:npm|yarn)\s+install\b/.test(dockerfile)) {
  throw new Error("Dockerfile: uncontracted package manager install detected");
}

if (/\bpnpm\s+(?:install|add|update)\b/.test(runnerStage)) {
  throw new Error("Dockerfile: final runtime stage cannot resolve dependencies");
}

if (/(?:^|\s)node:latest(?:\s|$)/m.test(dockerfile)) {
  throw new Error("Dockerfile: mutable latest base image is forbidden");
}

console.log("Reproducible Docker build contract verified.");
