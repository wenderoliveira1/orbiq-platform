import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const workflowPaths = [
  ".github/workflows/quality-gate.yml",
  ".github/workflows/autoqa.yml",
] as const;

test.describe("Fase 2.1D - checkout de CI sem credenciais persistentes", () => {
  for (const workflowPath of workflowPaths) {
    test(`${workflowPath} desativa persistência do token do checkout`, async () => {
      const workflow = await readFile(workflowPath, "utf8");
      const checkoutIndex = workflow.indexOf("uses: actions/checkout@");
      const persistIndex = workflow.indexOf("persist-credentials: false", checkoutIndex);

      expect(checkoutIndex).toBeGreaterThan(-1);
      expect(persistIndex).toBeGreaterThan(checkoutIndex);
      expect(workflow).not.toContain("persist-credentials: true");
    });
  }

  test("workflows permanecem somente-leitura no repositório", async () => {
    for (const workflowPath of workflowPaths) {
      const workflow = await readFile(workflowPath, "utf8");
      expect(workflow).toContain("permissions:\n  contents: read");
      expect(workflow).not.toMatch(/contents:\s*write/);
    }
  });
});
