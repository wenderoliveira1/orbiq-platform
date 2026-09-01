import { readFile } from "node:fs/promises";

const workflowPolicies = [
  {
    path: ".github/workflows/quality-gate.yml",
    maximumTimeoutMinutes: 40,
    requiresArtifactPolicy: false,
  },
  {
    path: ".github/workflows/autoqa.yml",
    maximumTimeoutMinutes: 45,
    requiresArtifactPolicy: true,
  },
];

for (const policy of workflowPolicies) {
  const source = await readFile(policy.path, "utf8");

  if (!/^\s{2}cancel-in-progress:\s*true\s*$/m.test(source)) {
    throw new Error(`${policy.path}: cancel-in-progress must remain enabled`);
  }

  if (!/^\s{4}runs-on:\s*ubuntu-24\.04\s*$/m.test(source)) {
    throw new Error(`${policy.path}: runner must remain pinned to ubuntu-24.04`);
  }

  const timeoutMatches = [...source.matchAll(/^\s{4}timeout-minutes:\s*(\d+)\s*$/gm)];
  if (timeoutMatches.length !== 1) {
    throw new Error(`${policy.path}: expected exactly one job timeout`);
  }

  const timeoutMinutes = Number(timeoutMatches[0][1]);
  if (timeoutMinutes > policy.maximumTimeoutMinutes) {
    throw new Error(
      `${policy.path}: timeout ${timeoutMinutes} exceeds ${policy.maximumTimeoutMinutes} minutes`,
    );
  }

  if (policy.requiresArtifactPolicy) {
    const retentionMatch = source.match(/^\s{10}retention-days:\s*(\d+)\s*$/m);
    const retentionDays = Number(retentionMatch?.[1] ?? 0);

    if (retentionDays < 1 || retentionDays > 14) {
      throw new Error(`${policy.path}: artifact retention must be between 1 and 14 days`);
    }

    if (!/^\s{8}if:\s*always\(\)\s*$/m.test(source)) {
      throw new Error(`${policy.path}: AutoQA report upload must run even after failures`);
    }

    if (!/^\s{10}if-no-files-found:\s*warn\s*$/m.test(source)) {
      throw new Error(`${policy.path}: missing AutoQA artifacts must remain a warning`);
    }
  }
}

console.log("CI resource and artifact bounds verified.");
