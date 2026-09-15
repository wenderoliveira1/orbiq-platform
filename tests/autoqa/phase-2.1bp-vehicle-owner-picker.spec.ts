import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BP — dono do veículo se diferencia por telefone", () => {
  test("cadastro de veículo busca cliente por nome ou telefone", async () => {
    const picker = await readFile(
      "apps/web/src/app/dashboard/_components/owner-customer-picker.tsx",
      "utf8",
    );
    const page = await readFile(
      "apps/web/src/app/dashboard/veiculos/page.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(picker).toContain("formatOwnerPhone");
    expect(picker).toContain("NOME OU TELEFONE");
    expect(picker).toContain("digits(customer.phone)");
    expect(picker).toContain('data-testid="owner-customer-picker"');
    expect(picker).not.toContain("service_role");

    expect(page).toContain("OwnerCustomerPicker");
    expect(page).toContain("id, name, phone, email");
    expect(page).toContain("Buscar placa, modelo, cliente ou telefone");

    expect(css).toContain(".owner-customer-picker");
    expect(css).toContain(".owner-customer-option");
    expect(css).not.toMatch(/\.owner-customer-option\s*\{[^}]*background:\s*#fff/s);
  });
});
