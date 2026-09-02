import { expect, test } from "@playwright/test";


test.describe("Fase 2.1AR - atualização segura do PWA em runtime", () => {
  test("mantém atualização explícita e não recarrega automaticamente", async ({ page }) => {
    await page.goto("/offline");

    const source = await page.evaluate(async () => {
      const response = await fetch("/sw.js", { cache: "no-store" });
      return response.text();
    });

    expect(source).toContain("skipWaiting");
    expect(source).toContain("clientsClaim");
    expect(source).toContain("message");
    expect(source).toContain("UPDATE");
    expect(source).not.toContain("caches.open(\"api\")");
  });

  test("a tela de instalação continua acessível em viewport móvel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/instalar");

    await expect(page.getByRole("heading", { name: /instalar/i })).toBeVisible();
    await expect(page.locator("body")).toContainText(/iPhone|Android|desktop/i);
  });
});
