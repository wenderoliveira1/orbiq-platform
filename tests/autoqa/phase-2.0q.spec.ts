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

test.describe("Fase 2.0Q - envio seguro de orçamento sem conexão", () => {
  test("avisa a perda de conexão, bloqueia submit e se recupera ao voltar online", async ({
    page,
    context,
  }) => {
    await login(page);
    await page.goto("/dashboard/orcamentos/novo");

    await context.setOffline(true);

    const warning = page.getByRole("alert").filter({
      hasText: "Sem conexão. O orçamento permanece nesta tela",
    });
    await expect(warning).toBeVisible();

    const prevented = await page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>("form.quote-builder");
      if (!form) return false;

      const event = new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
      });

      return !form.dispatchEvent(event);
    });

    expect(prevented).toBe(true);

    await context.setOffline(false);
    await expect(warning).toHaveCount(0);
  });

  test("não persiste orçamento no navegador e consulta navigator.onLine antes do envio", async () => {
    const source = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/submit-reliability-guard.tsx",
      "utf8",
    );

    expect(source).toContain("if (!navigator.onLine)");
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("event.stopImmediatePropagation()");
    expect(source).toContain('window.addEventListener("offline"');
    expect(source).toContain('window.addEventListener("online"');
    expect(source).toContain('role="alert"');
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("indexedDB");
  });
});
