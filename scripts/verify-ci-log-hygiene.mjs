import { readFile } from "node:fs/promises";

const workflowPaths = [
  ".github/workflows/quality-gate.yml",
  ".github/workflows/autoqa.yml",
];

const forbiddenPatterns = [
  {
    label: "shell tracing",
    pattern: /^\s*(?:set\s+-x|set\s+-o\s+xtrace)\s*$/m,
  },
  {
    label: "complete environment dump",
    pattern: /^\s*(?:run:\s*)?(?:env|printenv)\s*$/m,
  },
  {
    label: "GitHub secrets interpolation",
    pattern: /\$\{\{\s*secrets\./i,
  },
  {
    label: "GitHub secrets serialization",
    pattern: /tojson\(\s*secrets\s*\)/i,
  },
  {
    label: "unmasked Supabase environment output",
    pattern: /^\s*(?:run:\s*)?pnpm exec supabase status -o env\s*$/m,
  },
];

for (const workflowPath of workflowPaths) {
  const source = await readFile(workflowPath, "utf8");

  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(source)) {
      throw new Error(`${workflowPath}: forbidden CI log pattern: ${label}`);
    }
  }
}

const autoqaSource = await readFile(
  ".github/workflows/autoqa.yml",
  "utf8",
);

const requiredMasks = [
  'echo "::add-mask::$PUBLISHABLE_KEY"',
  'echo "::add-mask::$ANON_KEY"',
  'echo "::add-mask::$PUBLIC_KEY"',
];

for (const mask of requiredMasks) {
  if (!autoqaSource.includes(mask)) {
    throw new Error(`.github/workflows/autoqa.yml: missing mask command: ${mask}`);
  }
}

console.log("CI log hygiene verified.");
