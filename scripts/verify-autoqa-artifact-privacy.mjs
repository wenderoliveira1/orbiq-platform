import { readFile } from "node:fs/promises";

const path = ".github/workflows/autoqa.yml";
const source = await readFile(path, "utf8");

const requiredSnippets = [
  "uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7",
  "name: orbiq-autoqa-report-${{ github.run_id }}",
  "if-no-files-found: warn",
  "retention-days: 14",
  "include-hidden-files: false",
  "overwrite: false",
  "path: |\n            playwright-report\n            test-results",
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`${path}: AutoQA artifact privacy contract changed: ${snippet}`);
  }
}

const forbiddenArtifactPaths = [
  ".env",
  ".env.local",
  "$GITHUB_ENV",
  "node_modules",
  ".next",
  "supabase/.temp",
  "storage-state",
  "auth.json",
];

const uploadBlockMatch = source.match(
  /- name: Upload AutoQA report[\s\S]*?(?=\n\s{6}- name:|\s*$)/,
);

if (!uploadBlockMatch) {
  throw new Error(`${path}: AutoQA artifact upload step not found`);
}

const uploadBlock = uploadBlockMatch[0];

for (const forbiddenPath of forbiddenArtifactPaths) {
  if (uploadBlock.includes(forbiddenPath)) {
    throw new Error(
      `${path}: forbidden artifact path found in upload step: ${forbiddenPath}`,
    );
  }
}

console.log("AutoQA artifact privacy contract verified.");
