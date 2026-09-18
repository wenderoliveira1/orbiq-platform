import { expect, test } from "@playwright/test";
import { loadState } from "./support/orbiq-api";

import { normalizePlateQuery } from "../../apps/web/src/app/dashboard/orcamentos/novo/customer-phone-lookup";

test.describe("Fase 2.1BJ — placa preenche cliente no novo orçamento", () => {
  test("normaliza placa Mercosul e antiga", () => {
    expect(normalizePlateQuery("abc-1d23")).toBe("ABC1D23");
    expect(normalizePlateQuery(" ABC 1234 ")).toBe("ABC1234");
    expect(normalizePlateQuery("rio-2a34")).toBe("RIO2A34");
  });

  test("busca por placa preenche cliente e veículo e mantém os modos de serviço", async ({ page }) => {
    const state = await loadState();
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(state.email);
    await page.getByLabel("Senha").fill(state.password);
    await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/dashboard/orcamentos/novo");

    await page.getByRole("searchbox", { name: "Buscar por placa, telefone ou nome" }).fill("QAA1A23");
    await page.getByRole("listbox", { name: "Resultados da busca rápida" })
      .getByRole("option", { name: /QAA1A23/ }).click();
    await expect(page.locator('select[name="customer_id"]')).toHaveValue(state.customerId);
    await expect(page.locator('select[name="vehicle_id"]')).toHaveValue(state.vehicleId);

    const modes = page.getByRole("tablist", { name: "Como adicionar o serviço" });
    await expect(modes.getByRole("tab")).toHaveCount(3);
    await expect(modes.getByRole("tab", { name: "Funilaria", exact: true })).toHaveAttribute("aria-selected", "true");
    await modes.getByRole("tab", { name: "Catálogo", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "Buscar serviço", exact: true })).toBeVisible();
    await expect(modes.getByRole("tab", { name: "Funilaria", exact: true })).toHaveAttribute("aria-selected", "false");
    await modes.getByRole("tab", { name: "Digitar", exact: true }).click();
    await expect(page.getByPlaceholder("DESCRIÇÃO DO SERVIÇO", { exact: true })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Buscar serviço", exact: true })).toHaveCount(0);
  });
});
