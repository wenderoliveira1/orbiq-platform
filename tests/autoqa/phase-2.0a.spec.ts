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

test.describe("Fase 2.0A - prontidão Web e mobile", () => {
  test("expõe manifesto PWA e cabeçalhos de segurança", async ({
    request,
  }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");

    expect(manifestResponse.ok()).toBe(true);
    expect(manifestResponse.headers()["content-type"]).toContain(
      "application/manifest+json",
    );

    const manifest = (await manifestResponse.json()) as {
      display?: string;
      icons?: Array<{ purpose?: string; src?: string }>;
      name?: string;
      short_name?: string;
      start_url?: string;
    };

    expect(manifest).toMatchObject({
      display: "standalone",
      name: "Orbiq — Operações Automotivas",
      short_name: "Orbiq",
      start_url: "/dashboard",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: "any",
          src: "/icon.svg",
        }),
        expect.objectContaining({
          purpose: "maskable",
          src: "/icon.svg",
        }),
      ]),
    );

    const dashboardResponse = await request.get("/dashboard");
    const headers = dashboardResponse.headers();

    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("mantém a navegação completa utilizável em viewport mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await login(page);

    const navigation = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    const configuration = navigation.getByRole("link", {
      name: "Configurações",
    });

    await expect(navigation).toBeVisible();

    const navigationMetrics = await navigation.evaluate((element) => ({
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
      scrollWidth: element.scrollWidth,
    }));

    expect(navigationMetrics.overflowX).toBe("auto");
    expect(navigationMetrics.scrollWidth).toBeGreaterThan(
      navigationMetrics.clientWidth,
    );

    await configuration.scrollIntoViewIfNeeded();
    await expect(configuration).toBeVisible();
    await configuration.click();
    await expect(page).toHaveURL(/\/dashboard\/configuracoes$/);
  });
});
