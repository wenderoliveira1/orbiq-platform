import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0U - orçamento bruto de campos escalares", () => {
  test("limita campos escalares antes de trim, replace e parse", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );

    expect(actions).toContain("const MAX_ID_CHARS = 64");
    expect(actions).toContain("const MAX_PRIORITY_CHARS = 32");
    expect(actions).toContain("const MAX_MILEAGE_CHARS = 32");
    expect(actions).toContain("const MAX_NOTES_CHARS = 4_000");
    expect(actions).toContain('typeof value === "string" ? value : ""');

    const rawBudgetCheck = actions.indexOf(
      "customerIdRaw.length > MAX_ID_CHARS",
    );
    const firstTrim = actions.indexOf("customerIdRaw.trim()");
    const mileageParse = actions.indexOf("parseMileage(mileageRaw.trim())");
    const structuredParse = actions.indexOf(
      "parseQuotePayload(servicesRaw, itemsRaw, priorityRaw)",
    );

    expect(rawBudgetCheck).toBeGreaterThan(-1);
    expect(firstTrim).toBeGreaterThan(rawBudgetCheck);
    expect(mileageParse).toBeGreaterThan(rawBudgetCheck);
    expect(structuredParse).toBeGreaterThan(rawBudgetCheck);
  });

  test("rejeita File e mantém falha fechada sem refletir entrada", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );

    expect(actions).not.toContain("String(value ??");
    expect(actions).toContain('return failure("payload_invalid")');
    expect(actions).not.toContain("error.message");
    expect(actions).not.toContain("console.log(notesRaw");
    expect(actions).not.toContain("console.log(customerIdRaw");
  });
});
