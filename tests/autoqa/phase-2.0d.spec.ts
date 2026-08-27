import { expect, test, type Page } from "@playwright/test";

import { loadState } from "./support/orbiq-api";

async function loginOnMobile(page: Page) {
  const state = await loadState();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(state.email);
  await page.getByLabel("Senha").fill(state.password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Fase 2.0D - navegação mobile profissional", () => {
  test("oferece menu acessível, troca de oficina e encerramento de sessão", async ({
    page,
  }) => {
    await loginOnMobile(page);

    const trigger = page.getByRole("button", {
      name: "Abrir menu principal",
    });

    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Menu principal" });

    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Fechar menu principal" }),
    ).toBeFocused();
    await expect(dialog.getByLabel("Oficina ativa")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Sair do Orbiq" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    const dockTrigger = page.getByRole("button", {
      name: "Abrir menu completo",
    });

    await dockTrigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dockTrigger).toBeFocused();
  });

  test("mantém os atalhos essenciais dentro da viewport", async ({ page }) => {
    await loginOnMobile(page);

    const dock = page.getByRole("navigation", { name: "Atalhos móveis" });
    const bounds = await dock.boundingBox();

    await expect(dock).toBeVisible();
    expect(bounds).not.toBeNull();

    if (!bounds) {
      throw new Error("A barra móvel não possui dimensões calculadas.");
    }

    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);

    await expect(
      dock.getByRole("link", { name: "Visão geral" }),
    ).toBeVisible();
    const newQuote = dock.getByRole("link", { name: "Novo orçamento" });
    await expect(newQuote).toBeVisible();
    await expect(
      dock.getByRole("link", { name: "Orçamentos", exact: true }),
    ).toBeVisible();
    await expect(
      dock.getByRole("button", { name: "Abrir menu completo" }),
    ).toBeVisible();

    await newQuote.click();
    await expect(page).toHaveURL(/\/dashboard\/orcamentos\/novo$/);
  });
});
