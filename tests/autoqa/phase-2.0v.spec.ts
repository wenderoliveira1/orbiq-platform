import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0V - integridade estrutural do FormData", () => {
  test("exige exatamente um valor textual para cada campo do orçamento", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );

    expect(actions).toContain("formData.getAll(name)");
    expect(actions).toContain("values.length !== 1");
    expect(actions).toContain('typeof values[0] !== "string"');

    for (const field of [
      "customer_id",
      "vehicle_id",
      "priority",
      "mileage",
      "notes",
      "services_json",
      "items_json",
    ]) {
      expect(actions).toContain(`singleRawText(formData, "${field}")`);
    }
  });

  test("fecha parameter pollution antes de normalização e parse", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );

    const shapeGate = actions.indexOf("values.length !== 1");
    const firstFieldRead = actions.indexOf(
      'singleRawText(formData, "customer_id")',
    );
    const firstTrim = actions.indexOf("customerIdRaw.trim()");
    const structuredParse = actions.indexOf(
      "parseQuotePayload(servicesRaw, itemsRaw, priorityRaw)",
    );

    expect(shapeGate).toBeGreaterThan(-1);
    expect(firstFieldRead).toBeGreaterThan(shapeGate);
    expect(firstTrim).toBeGreaterThan(firstFieldRead);
    expect(structuredParse).toBeGreaterThan(firstTrim);
    expect(actions).not.toContain("formData.get(\"");
    expect(actions).toContain('return failure("payload_invalid")');
    expect(actions).not.toContain("error.message");
  });
});
