import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { normalizePlateQuery } from "../../apps/web/src/app/dashboard/orcamentos/novo/customer-phone-lookup";

test.describe("Fase 2.1BJ — placa preenche cliente no novo orçamento", () => {
  test("normaliza placa Mercosul e antiga", () => {
    expect(normalizePlateQuery("abc-1d23")).toBe("ABC1D23");
    expect(normalizePlateQuery(" ABC 1234 ")).toBe("ABC1234");
    expect(normalizePlateQuery("rio-2a34")).toBe("RIO2A34");
  });

  test("Novo Orçamento tem busca por placa e preenche selects existentes", async () => {
    const lookup = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/customer-phone-lookup.tsx",
      "utf8",
    );
    const page = await readFile("apps/web/src/app/dashboard/orcamentos/novo/page.tsx", "utf8");

    expect(page).toContain("CustomerPhoneLookup");
    expect(lookup).toContain('data-testid="quote-identity-lookup"');
    expect(lookup).toContain('data-testid="quote-plate-lookup"');
    expect(lookup).toContain('data-testid="quote-plate-lookup-hit"');
    expect(lookup).toContain("normalizePlateQuery");
    expect(lookup).toContain('setSelectValue("customer_id"');
    expect(lookup).toContain('setSelectValue("vehicle_id"');
    expect(lookup).toContain("DIGITE A PLACA");
    expect(lookup).not.toContain("service_role");
    expect(lookup).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE");
  });
});
