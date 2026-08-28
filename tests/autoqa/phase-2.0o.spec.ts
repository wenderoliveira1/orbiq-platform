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

test.describe("Fase 2.0O - confiabilidade do envio de orçamento", () => {
  test("mantém o botão de salvar acessível e inicialmente disponível conforme validação", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/dashboard/orcamentos/novo");

    const save = page.getByRole("button", { name: "Salvar orçamento" });
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute("aria-busy", "false");
  });

  test("bloqueia reenvio enquanto o primeiro submit está em andamento e não persiste dados", async () => {
    const source = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/submit-reliability-guard.tsx",
      "utf8",
    );
    const pageSource = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/page.tsx",
      "utf8",
    );

    expect(source).toContain("if (locked)");
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("event.stopImmediatePropagation()");
    expect(source).toContain('submitButton.setAttribute("aria-busy"');
    expect(source).toContain("Salvando orçamento...");
    expect(source).toContain('window.addEventListener("pageshow"');
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("indexedDB");
    expect(pageSource).toContain("<SubmitReliabilityGuard />");
  });
});
