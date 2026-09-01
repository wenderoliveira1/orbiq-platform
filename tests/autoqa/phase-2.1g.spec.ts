import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const workflows = [
  ".github/workflows/quality-gate.yml",
  ".github/workflows/autoqa.yml",
] as const;

test.describe("Fase 2.1G - runtime reproduzível", () => {
  test("declara Node e pnpm como contrato do repositório", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      packageManager?: string;
      engines?: { node?: string };
    };
    const nodeVersion = (await readFile(".node-version", "utf8")).trim();

    expect(packageJson.packageManager).toBe("pnpm@11.22.0");
    expect(packageJson.engines?.node).toBe(">=22.23.2 <23");
    expect(nodeVersion).toBe("22.23.2");
  });

  test("os dois gates usam e verificam exatamente a mesma toolchain", async () => {
    for (const workflowPath of workflows) {
      const workflow = await readFile(workflowPath, "utf8");

      expect(workflow).toContain("runtime: node@22.23.2");
      expect(workflow).toContain("version: 11.22.0");
      expect(workflow).toContain('test "$(node --version)" = "v22.23.2"');
      expect(workflow).toContain('test "$(pnpm --version)" = "11.22.0"');
      expect(workflow).not.toContain("runtime: node@22\n");
    }
  });
});
