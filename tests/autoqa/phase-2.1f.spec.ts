import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const workflowPaths = [
  ".github/workflows/quality-gate.yml",
  ".github/workflows/autoqa.yml",
] as const;

test.describe("Fase 2.1F - telemetria externa desativada no CI", () => {
  for (const workflowPath of workflowPaths) {
    test(`${workflowPath} desativa explicitamente a telemetria do Next.js`, async () => {
      const workflow = await readFile(workflowPath, "utf8");

      expect(workflow).toContain('NEXT_TELEMETRY_DISABLED: "1"');
      expect(workflow).not.toContain('NEXT_TELEMETRY_DISABLED: "0"');
    });
  }

  test("a política permanece global aos jobs dos gates", async () => {
    for (const workflowPath of workflowPaths) {
      const workflow = await readFile(workflowPath, "utf8");
      const envIndex = workflow.indexOf("env:\n  NEXT_TELEMETRY_DISABLED");
      const jobsIndex = workflow.indexOf("jobs:");

      expect(envIndex).toBeGreaterThan(-1);
      expect(jobsIndex).toBeGreaterThan(envIndex);
    }
  });
});
