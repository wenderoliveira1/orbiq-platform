import { expect, test, type Page } from "@playwright/test";

import { loadState } from "./support/orbiq-api";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

const routes = [
  "/dashboard",
  "/dashboard/atividade",
  "/dashboard/clientes",
  "/dashboard/veiculos",
  "/dashboard/orcamentos",
  "/dashboard/orcamentos/novo",
  "/dashboard/cotacoes",
  "/dashboard/comercial",
  "/dashboard/fornecedores",
  "/dashboard/mao-de-obra",
  "/dashboard/compras",
  "/dashboard/execucao",
  "/dashboard/equipe",
  "/dashboard/indicadores",
  "/dashboard/oficinas",
  "/dashboard/configuracoes",
];

test.describe("Regressão operacional - smoke test", () => {
  test("proprietário continua acessando os módulos críticos sem erro de servidor", async ({
    page,
  }) => {
    const state = await loadState();
    await login(page, state.email, state.password);

    for (const route of routes) {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });

      expect(
        response?.status() ?? 200,
        `HTTP inválido em ${route}`,
      ).toBeLessThan(500);

      await expect(
        page.locator("body"),
        `erro visual em ${route}`,
      ).not.toContainText(
        /Application error|Internal Server Error|Unhandled Runtime Error|permission denied|Permissão negada/i,
      );
    }
  });

  test("dados AutoQA continuam visíveis nos módulos-base", async ({ page }) => {
    const state = await loadState();
    await login(page, state.email, state.password);

    await page.goto("/dashboard/clientes");
    await expect(page.getByText("Cliente AutoQA")).toBeVisible();

    await page.goto("/dashboard/veiculos");
    await expect(page.getByText("QAA1A23")).toBeVisible();

    await page.goto("/dashboard/fornecedores");
    await expect(page.getByText("Fornecedor AutoQA")).toBeVisible();

    await page.goto("/dashboard/comercial");
    await expect(page.getByText(/AUTOQA-/).first()).toBeVisible();
  });

  test("navegação lateral mantém todos os módulos acessíveis em telas baixas", async ({
    page,
  }) => {
    await page.setViewportSize({
      width: 1280,
      height: 620,
    });

    const state = await loadState();
    await login(page, state.email, state.password);

    const navigation = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    const settings = navigation.getByRole("link", {
      name: "Configurações",
    });
    const signOut = page.getByRole("button", {
      name: "Sair",
    });

    await expect(navigation).toHaveAttribute("tabindex", "0");
    await expect(signOut).toBeInViewport();

    const scrollState = await navigation.evaluate((element) => {
      const styles = window.getComputedStyle(element);

      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: styles.overflowY,
      };
    });

    expect(scrollState.overflowY).toBe("auto");
    expect(scrollState.scrollHeight).toBeGreaterThan(
      scrollState.clientHeight,
    );

    await navigation.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    await expect(settings).toBeInViewport();
    await expect(signOut).toBeInViewport();

    await settings.click();

    await expect(page).toHaveURL("/dashboard/configuracoes");
    await expect(settings).toHaveAttribute("aria-current", "page");
    await expect(settings).toBeInViewport();
  });
});
