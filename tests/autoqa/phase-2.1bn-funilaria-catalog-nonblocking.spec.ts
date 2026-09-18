import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BN — Funilaria entra no orçamento mesmo se o catálogo falhar", () => {
  test("serviço guiado não depende do alerta de catálogo", async () => {
    const builder = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-builder.tsx",
      "utf8",
    );
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );
    const migration = await readFile(
      "supabase/migrations/20260914163000_save_service_catalog_conflict.sql",
      "utf8",
    );

    expect(builder).not.toContain("NÃO FOI POSSÍVEL SALVAR O SERVIÇO NO CATÁLOGO.");
    expect(builder).toContain("addVoiceOrGuidedService");
    expect(builder).toContain("setSelectedServices");
    expect(builder).toContain("saveServiceCatalogAction");

    const addFn = builder.slice(builder.indexOf("function addVoiceOrGuidedService"));
    expect(addFn.indexOf("setSelectedServices")).toBeLessThan(addFn.indexOf("saveServiceCatalogAction"));

    expect(actions).toContain("Promise<string | null>");
    expect(actions).toContain('.from("service_catalog")');
    expect(actions).not.toContain("error.message");
    expect(actions).toContain('failure("save_failed")');

    expect(migration).toContain("unique_violation");
    expect(migration).toContain("save_service_catalog");
    // Comments describe the restriction; inspect executable SQL instead.
    const sql = migration.replace(/--[^\n]*/g, "");
    expect(sql).not.toContain("service_role");
    expect(sql).toMatch(/security\s+invoker/i);
  });
});
