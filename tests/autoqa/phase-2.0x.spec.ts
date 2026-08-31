import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const workflows = [
  ".github/workflows/quality-gate.yml",
  ".github/workflows/autoqa.yml",
];

const pinnedAction = /uses:\s+[\w./-]+@[0-9a-f]{40}(?:\s+#\s+v[^\n]+)?/g;

test.describe("Fase 2.0X - cadeia de CI reproduzível", () => {
  test("fixa o runner e não usa tags mutáveis de actions", async () => {
    for (const path of workflows) {
      const source = await readFile(path, "utf8");
      expect(source).toContain("runs-on: ubuntu-24.04");
      expect(source).not.toContain("runs-on: ubuntu-latest");

      const usesLines = source
        .split(/\r?\n/)
        .filter((line) => line.trim().startsWith("uses:"));

      expect(usesLines.length).toBeGreaterThan(0);
      for (const line of usesLines) {
        expect(line).toMatch(/^\s*uses:\s+[\w./-]+@[0-9a-f]{40}(?:\s+#\s+v[^\n]+)?\s*$/);
      }

      expect(source.match(pinnedAction)?.length).toBe(usesLines.length);
    }
  });

  test("mantém permissões mínimas dos workflows", async () => {
    for (const path of workflows) {
      const source = await readFile(path, "utf8");
      expect(source).toContain("permissions:\n  contents: read");
      expect(source).not.toMatch(/permissions:\s*write-all/);
    }
  });
});
