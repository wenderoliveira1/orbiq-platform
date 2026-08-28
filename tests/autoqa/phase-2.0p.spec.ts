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

test.describe("Fase 2.0P - erros seguros no novo orçamento", () => {
  test("não reflete texto arbitrário do parâmetro de erro na interface", async ({
    page,
  }) => {
    await login(page);

    const internalMessage = "relation public.quotes does not exist token=secret";
    await page.goto(
      `/dashboard/orcamentos/novo?error=${encodeURIComponent(internalMessage)}`,
    );

    await expect(page.getByText("Não foi possível concluir a operação. Tente novamente.")).toBeVisible();
    await expect(page.getByText(internalMessage)).toHaveCount(0);
  });

  test("server action usa somente códigos estáveis e não concatena erro do Supabase", async () => {
    const actionSource = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );
    const errorSource = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-errors.ts",
      "utf8",
    );
    const pageSource = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/page.tsx",
      "utf8",
    );

    expect(actionSource).toContain('failure("save_failed")');
    expect(actionSource).toContain('failure("result_invalid")');
    expect(actionSource).not.toContain("error.message");
    expect(actionSource).not.toContain("encodeURIComponent");
    expect(pageSource).toContain("quoteErrorMessage(query.error)");
    expect(pageSource).not.toContain("customersResult.error.message");
    expect(errorSource).toContain("Object.prototype.hasOwnProperty.call");
    expect(errorSource).toContain("Não foi possível concluir a operação. Tente novamente.");
  });
});
