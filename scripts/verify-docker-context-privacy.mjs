import { readFile } from "node:fs/promises";

const [dockerignore, dockerfile] = await Promise.all([
  readFile(".dockerignore", "utf8"),
  readFile("Dockerfile", "utf8"),
]);

const rules = dockerignore
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

const requiredExclusions = [
  ".git",
  ".github",
  "**/.next",
  "**/node_modules",
  ".env",
  ".env.*",
  "**/.env",
  "**/.env.*",
  ".autoqa",
  "playwright-report",
  "test-results",
  "coverage",
  "**/coverage",
  "supabase/.temp",
  "supabase/.branches",
  "*.log",
  "**/*.log",
];

for (const exclusion of requiredExclusions) {
  if (!rules.includes(exclusion)) {
    throw new Error(
      `.dockerignore: missing protected build-context exclusion: ${exclusion}`,
    );
  }
}

const sensitiveMarkers = [
  ".git",
  ".github",
  ".next",
  "node_modules",
  ".env",
  ".autoqa",
  "playwright-report",
  "test-results",
  "coverage",
  "supabase/.temp",
  "supabase/.branches",
  ".log",
];

for (const rule of rules) {
  if (!rule.startsWith("!")) {
    continue;
  }

  const reopenedPath = rule.slice(1).toLowerCase();
  if (sensitiveMarkers.some((marker) => reopenedPath.includes(marker))) {
    throw new Error(
      `.dockerignore: protected path cannot be re-included: ${rule}`,
    );
  }
}

if (!/^COPY\s+\.\s+\.\s*$/m.test(dockerfile)) {
  throw new Error(
    "Dockerfile: broad source copy contract changed; review build-context privacy guard",
  );
}

console.log("Docker build-context privacy contract verified.");
