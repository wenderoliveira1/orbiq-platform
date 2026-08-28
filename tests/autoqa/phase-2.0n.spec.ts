import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { loadState } from "./support/orbiq-api";

async function login(page: Page) {
  const state = await loadState();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(state.email);
  await page.getByLabel("Senha").fill(state.password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Fase 2.0N - proteção do orçamento em edição", () => {
  test("avisa antes de abandonar alterações e respeita a decisão do usuário", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/dashboard/orcamentos/novo");

    await page.getByLabel("Quilometragem *").fill("87500");

    const navigation = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    const customers = navigation.getByRole("link", {
      name: "Clientes",
    });

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain("alterações não salvas");
      await dialog.dismiss();
    });

    await customers.click();
    await expect(page).toHaveURL("/dashboard/orcamentos/novo");

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });

    await customers.click();
    await expect(page).toHaveURL("/dashboard/clientes");
  });

  test("mantém proteção nativa para fechar ou recarregar a aba", async () => {
    const source = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/unsaved-quote-guard.tsx",
      "utf8",
    );

    expect(source).toContain('window.addEventListener("beforeunload"');
    expect(source).toContain('document.addEventListener("click", handleDocumentClick, true)');
    expect(source).toContain('form.addEventListener("submit", markSubmitted)');
    expect(source).not.toContain("error.message");
  });
});
