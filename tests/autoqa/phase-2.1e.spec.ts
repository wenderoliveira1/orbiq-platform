import { readdir, readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1E - higiene do repositório", () => {
  test("documentação não mantém notas temporárias de fase", async () => {
    const docs = await readdir("docs");
    const temporaryPhaseNotes = docs.filter((name) =>
      /(?:-extra\.md|-note\.txt)$/u.test(name),
    );

    expect(temporaryPhaseNotes).toEqual([]);
  });

  test("documento canônico da 2.1D permanece preservado", async () => {
    const phaseDocument = await readFile("docs/phase-2.1d.md", "utf8");

    expect(phaseDocument).toContain(
      "# Fase 2.1D — Checkout de CI sem credenciais persistentes",
    );
    expect(phaseDocument).toContain("persist-credentials: false");
  });
});
