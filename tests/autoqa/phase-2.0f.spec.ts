import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

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

async function expectPng(
  request: APIRequestContext,
  path: string,
  expectedSize: number,
) {
  const response = await request.get(path);
  const body = await response.body();

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect([...body.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(body.readUInt32BE(16)).toBe(expectedSize);
  expect(body.readUInt32BE(20)).toBe(expectedSize);
}

test.describe("Fase 2.0F - instalação multiplataforma", () => {
  test("publica ícones raster, maskable, atalhos e metadados Apple", async ({
    page,
    request,
  }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");
    const manifest = (await manifestResponse.json()) as {
      icons?: Array<{ purpose?: string; sizes?: string; src?: string }>;
      launch_handler?: { client_mode?: string };
      shortcuts?: Array<{ name?: string; url?: string }>;
    };

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: "any",
          sizes: "192x192",
          src: "/icons/orbiq-192.png",
        }),
        expect.objectContaining({
          purpose: "any",
          sizes: "512x512",
          src: "/icons/orbiq-512.png",
        }),
        expect.objectContaining({
          purpose: "maskable",
          sizes: "512x512",
          src: "/icons/orbiq-maskable-512.png",
        }),
      ]),
    );
    expect(manifest.launch_handler).toEqual({ client_mode: "focus-existing" });
    expect(manifest.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Novo orçamento",
          url: "/dashboard/orcamentos/novo",
        }),
        expect.objectContaining({
          name: "Orçamentos",
          url: "/dashboard/orcamentos",
        }),
      ]),
    );

    await expectPng(request, "/icons/orbiq-192.png", 192);
    await expectPng(request, "/icons/orbiq-512.png", 512);
    await expectPng(request, "/icons/orbiq-maskable-512.png", 512);
    await expectPng(request, "/icons/orbiq-apple-touch-icon.png", 180);

    await page.goto("/instalar");
    await expect(
      page.locator('meta[name="mobile-web-app-capable"]'),
    ).toHaveAttribute("content", "yes");
    await expect(
      page.locator('meta[name="apple-mobile-web-app-capable"]'),
    ).toHaveAttribute("content", "yes");
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]'),
    ).toHaveAttribute("content", "Orbiq");

    const appleIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleIcon).toHaveAttribute("href", /apple-icon/);
  });

  test("expõe a instalação no menu mobile e mantém o guia responsivo", async ({
    page,
  }) => {
    await loginOnMobile(page);
    await page.getByRole("button", { name: "Abrir menu principal" }).click();
    await page.getByRole("link", { name: "Instalar aplicativo" }).click();

    await expect(page).toHaveURL(/\/instalar$/);
    await expect(
      page.getByRole("heading", { name: "Leve o Orbiq com você." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "iPhone e iPad" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Celular Android" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Computador" }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
