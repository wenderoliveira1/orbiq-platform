import { readFile } from "node:fs/promises";

const workflowPolicies = [
  {
    path: ".github/workflows/quality-gate.yml",
    triggerBlock: `on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
`,
    concurrencyGroup:
      "group: orbiq-quality-${{ github.event.pull_request.head.ref || github.ref_name }}",
  },
  {
    path: ".github/workflows/autoqa.yml",
    triggerBlock: `on:
  push:
    branches:
      - "qa/**"
  pull_request:
    branches:
      - main
  workflow_dispatch:
`,
    concurrencyGroup:
      "group: orbiq-autoqa-${{ github.event.pull_request.head.ref || github.ref_name }}",
  },
];

const forbiddenTriggers = [
  "pull_request_target:",
  "repository_dispatch:",
  "schedule:",
];

for (const policy of workflowPolicies) {
  const source = await readFile(policy.path, "utf8");

  if (!source.includes(policy.triggerBlock)) {
    throw new Error(`${policy.path}: workflow trigger contract changed`);
  }

  for (const forbiddenTrigger of forbiddenTriggers) {
    if (source.includes(forbiddenTrigger)) {
      throw new Error(
        `${policy.path}: forbidden workflow trigger found: ${forbiddenTrigger}`,
      );
    }
  }

  const groupMatches = source.match(/^\s{2}group:\s*(.+)\s*$/gm) ?? [];
  if (
    groupMatches.length !== 1 ||
    groupMatches[0].trim() !== policy.concurrencyGroup
  ) {
    throw new Error(`${policy.path}: concurrency group contract changed`);
  }

  if (!/^\s{2}cancel-in-progress:\s*true\s*$/m.test(source)) {
    throw new Error(`${policy.path}: superseded runs must remain cancellable`);
  }
}

console.log("CI trigger and concurrency contracts verified.");
