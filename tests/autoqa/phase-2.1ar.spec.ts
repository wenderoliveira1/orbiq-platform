import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AR - atualização segura do PWA em runtime", () => {
  test("mantém atualização explícita, escopo seguro e nenhuma rota de API no cache", async ({
    page,
  }) => {
    await page.goto("/offline");

    const registration = await page.evaluate(async () => {
      const current = await navigator.serviceWorker.ready;
      return {
        scope: current.scope,
        updateViaCache: current.updateViaCache,
        hasWaitingWorker: Boolean(current.waiting),
      };
    });

    const source = await page.evaluate(async () => {
      const response = await fetch("/sw.js", { cache: "no-store" });
      return response.text();
    });

    expect(registration.scope).toBe(new URL("/", page.url()).href);
    expect(registration.updateViaCache).toBe("none");
    expect(registration.hasWaitingWorker).toBe(false);

    expect(source).toContain('const SKIP_WAITING_MESSAGE = "ORBIQ_SKIP_WAITING";');
    expect(source).toContain('globalThis.addEventListener("message"');
    expect(source).toContain("event.waitUntil(globalThis.skipWaiting());");
    expect(source).toContain("globalThis.clients.claim();");
    expect(source).toContain('if (request.method !== "GET")');
    expect(source).toContain("if (url.origin !== globalThis.location.origin)");
    expect(source).toContain("PUBLIC_PATHS.has(url.pathname)");
    expect(source).not.toContain("/api/");
    expect(source).not.toContain('caches.open("api")');
  });

  test("a tela de instalação continua acessível em viewport móvel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/instalar");

    await expect(
      page.getByRole("heading", { name: /Leve o Orbiq com você/i }),
    ).toBeVisible();
    await expect(page.locator("body")).toContainText(
      /iPhone e iPad|Celular Android|Computador/i,
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
