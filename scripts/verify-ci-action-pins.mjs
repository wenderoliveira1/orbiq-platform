import { readFile } from "node:fs/promises";

const workflowPaths = [
  ".github/workflows/quality-gate.yml",
  ".github/workflows/autoqa.yml",
];

const immutableActionPattern = /^[0-9a-f]{40}$/i;

for (const workflowPath of workflowPaths) {
  const source = await readFile(workflowPath, "utf8");
  const actionReferences = [...source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)];

  if (actionReferences.length === 0) {
    throw new Error(`${workflowPath}: no action references found`);
  }

  for (const [, reference] of actionReferences) {
    const separator = reference.lastIndexOf("@");
    const action = reference.slice(0, separator);
    const revision = reference.slice(separator + 1);

    if (!action || !immutableActionPattern.test(revision)) {
      throw new Error(
        `${workflowPath}: action reference must use a full commit SHA: ${reference}`,
      );
    }
  }

  if (!/^permissions:\n\s{2}contents:\s*read\s*$/m.test(source)) {
    throw new Error(`${workflowPath}: workflow permissions must remain contents: read`);
  }
}

console.log("CI action pinning and least-privilege permissions verified.");
