import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0R - validação defensiva do novo orçamento", () => {
  test("mantém contrato fechado antes do RPC de criação", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );
    const payload = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-payload.ts",
      "utf8",
    );

    expect(actions).toContain("parseQuotePayload(servicesRaw, itemsRaw, priorityRaw)");
    expect(actions).toContain("if (!payload) return failure(\"payload_invalid\")");
    expect(actions).toContain("target_priority: payload.priority");
    expect(actions).toContain("services: payload.services");
    expect(actions).toContain("items: payload.items");
    expect(actions).toContain("const MAX_NOTES_CHARS = 4_000");
    expect(actions).toContain("notesRaw.length > MAX_NOTES_CHARS");
    expect(actions).toContain("value > 9_999_999");
    expect(actions).not.toContain("services = JSON.parse");
    expect(actions).not.toContain("target_priority: priorityRaw");

    expect(payload).toContain('"normal"');
    expect(payload).toContain('"customer_waiting"');
    expect(payload).toContain('"vehicle_stopped"');
    expect(payload).toContain("servicesValue.length > 100");
    expect(payload).toContain("itemsValue.length > 250");
    expect(payload).toContain("value <= 1_000_000");
    expect(payload).toContain("value <= 100_000");
    expect(payload).toContain("isUuid(laborServiceId)");
  });

  test("fluxo legítimo continua acessível e sem erro interno refletido", async ({ page }) => {
    await page.goto("/dashboard/orcamentos/novo?error=payload_invalid");
    await expect(page.locator("body")).not.toContainText("PostgreSQL");
    await expect(page.locator("body")).not.toContainText("Supabase");
  });
});
