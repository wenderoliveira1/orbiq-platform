import { expect, test, type Page } from "@playwright/test";

import { loadState } from "./support/orbiq-api";

async function login(page: Page) {
  const state = await loadState();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(state.email);
  await page.getByLabel("Senha").fill(state.password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  return state;
}

test.describe("Fase 2.0H - diagnóstico e suporte seguro", () => {
  test("valida prontidão sem expor identidade, dados operacionais ou segredos", async ({
    page,
  }) => {
    const state = await login(page);

    await page.goto("/dashboard/suporte");
    await expect(
      page.getByRole("heading", { name: "Diagnóstico do Orbiq" }),
    ).toBeVisible();

    await expect(
      page.locator('[data-orbiq-diagnostic="web"]'),
    ).toHaveAttribute("data-status", "ok", { timeout: 20_000 });
    await expect(
      page.locator('[data-orbiq-diagnostic="ready"]'),
    ).toHaveAttribute("data-status", "ok");
    await expect(
      page.locator('[data-orbiq-diagnostic="manifest"]'),
    ).toHaveAttribute("data-status", "ok");
    await expect(
      page.locator('[data-orbiq-diagnostic="connection"]'),
    ).toHaveAttribute("data-status", "ok");

    const report = await page.locator("[data-orbiq-safe-report]").innerText();

    expect(report).toContain("ORBIQ — DIAGNÓSTICO SEGURO");
    expect(report).toContain("rota=/dashboard/suporte");
    expect(report).not.toContain(state.email);
    expect(report).not.toMatch(/sb_(?:publishable|secret)_/i);
    expect(report).not.toMatch(/bearer\s+/i);
    expect(report).not.toContain("127.0.0.1:54321");
    expect(report).not.toContain("customer");
    expect(report).not.toContain("vehicle");
  });

  test("expõe suporte no menu mobile e preserva a viewport", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await login(page);

    await page.getByRole("button", { name: "Abrir menu principal" }).click();

    const supportLink = page.getByRole("link", { name: "Suporte técnico" });
    await expect(supportLink).toBeVisible();
    await supportLink.click();

    await expect(page).toHaveURL(/\/dashboard\/suporte$/);
    await expect(
      page.getByRole("button", { name: "Atualizar diagnóstico" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copiar diagnóstico seguro" }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
