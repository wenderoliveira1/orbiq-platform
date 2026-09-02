import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AQ — PWA offline em runtime", () => {
  test("registra o service worker e entrega o shell offline sem rede", async ({
    page,
    context,
  }) => {
    await page.goto("/offline", { waitUntil: "domcontentloaded" });

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration("/");
            return Boolean(
              registration?.active?.scriptURL.endsWith("/sw.js"),
            );
          }),
        { timeout: 15_000, intervals: [250, 500, 1_000] },
      )
      .toBe(true);

    const cacheSnapshot = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const publicCacheNames = cacheNames.filter((name) =>
        name.startsWith("orbiq-"),
      );
      const entries = [];

      for (const name of publicCacheNames) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        entries.push(
          ...requests.map((request) => new URL(request.url).pathname),
        );
      }

      return {
        cacheNames: publicCacheNames,
        entries,
      };
    });

    expect(cacheSnapshot.cacheNames).toContain("orbiq-public-shell-v3");
    expect(cacheSnapshot.entries).toContain("/offline");
    expect(cacheSnapshot.entries.some((path) => path.startsWith("/api/"))).toBe(
      false,
    );

    await context.setOffline(true);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toHaveText("Você está sem conexão");
    await expect(page.getByText("Seus dados continuam protegidos")).toBeVisible();

    await context.setOffline(false);
  });

  test("mantém o cache público na origem do aplicativo", async ({ page }) => {
    await page.goto("/offline", { waitUntil: "domcontentloaded" });

    const appOrigin = await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration("/");
            return registration?.active?.scriptURL
              ? new URL(registration.active.scriptURL).origin
              : null;
          }),
        { timeout: 15_000, intervals: [250, 500, 1_000] },
      )
      .not.toBeNull()
      .then(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration("/");
          return registration?.active?.scriptURL
            ? new URL(registration.active.scriptURL).origin
            : null;
        }),
      );

    const cacheEntries = await page.evaluate(async () => {
      const cache = await caches.open("orbiq-public-shell-v3");
      const requests = await cache.keys();
      return requests.map((request) => new URL(request.url));
    });

    expect(appOrigin).toBeTruthy();
    expect(cacheEntries.every((url) => url.origin === appOrigin)).toBe(true);
  });
});
