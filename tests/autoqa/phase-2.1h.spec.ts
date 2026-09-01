import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const workflows = [
  ".github/workflows/quality-gate.yml",
  ".github/workflows/autoqa.yml",
];

test.describe("Fase 2.1H - guardas da toolchain Supabase", () => {
  for (const workflow of workflows) {
    test(`${workflow} valida a Supabase CLI antes dos gates`, async () => {
      const source = await readFile(workflow, "utf8");

      expect(source).toContain("Verify Supabase CLI contract");
      expect(source).toContain(
        'test "$(pnpm exec supabase --version)" = "2.115.0"',
      );
      expect(source.indexOf("pnpm install --frozen-lockfile")).toBeLessThan(
        source.indexOf("Verify Supabase CLI contract"),
      );
    });
  }

  test("o lockfile continua resolvendo a versão validada", async () => {
    const lockfile = await readFile("pnpm-lock.yaml", "utf8");

    expect(lockfile).toContain("specifier: ^2.115.0");
    expect(lockfile).toContain("version: 2.115.0");
  });
});
