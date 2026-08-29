import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0T - orçamento com orçamento bruto de payload", () => {
  test("bloqueia JSON exagerado antes do parse estruturado", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );

    expect(actions).toContain("const MAX_SERVICES_JSON_CHARS = 128_000");
    expect(actions).toContain("const MAX_ITEMS_JSON_CHARS = 512_000");
    expect(actions).toContain("servicesRaw.length > MAX_SERVICES_JSON_CHARS");
    expect(actions).toContain("itemsRaw.length > MAX_ITEMS_JSON_CHARS");

    const rawBudgetCheck = actions.indexOf(
      "servicesRaw.length > MAX_SERVICES_JSON_CHARS",
    );
    const structuredParse = actions.indexOf(
      "parseQuotePayload(servicesRaw, itemsRaw, priorityRaw)",
    );

    expect(rawBudgetCheck).toBeGreaterThan(-1);
    expect(structuredParse).toBeGreaterThan(rawBudgetCheck);
  });

  test("mantém falha fechada e não amplia detalhes expostos", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );

    expect(actions).toContain('return failure("payload_invalid")');
    expect(actions).not.toContain("error.message");
    expect(actions).not.toContain("JSON.stringify(formData");
    expect(actions).not.toContain("console.log(servicesRaw");
    expect(actions).not.toContain("console.log(itemsRaw");
  });
});
