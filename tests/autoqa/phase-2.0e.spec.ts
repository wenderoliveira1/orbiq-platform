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

async function waitForServiceWorkerControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;

    if (navigator.serviceWorker.controller) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("O service worker não assumiu o controle da página."));
      }, 10_000);

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
  });
}

test.describe("Fase 2.0E - resiliência de conectividade", () => {
  test("serve o service worker com política segura de atualização", async ({
    request,
  }) => {
    const response = await request.get("/sw.js");

    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["content-security-policy"]).toBe(
      "default-src 'self'; script-src 'self'",
    );
    expect(response.headers()["content-type"]).toContain(
      "application/javascript",
    );
    expect(response.headers()["service-worker-allowed"]).toBe("/");
  });

  test("avisa a perda de rede e entrega fallback sem cache autenticado", async ({
    context,
    page,
  }) => {
    await login(page);
    await waitForServiceWorkerControl(page);

    const cachedPaths = await page.evaluate(async () => {
      const names = await globalThis.caches.keys();
      const requests = await Promise.all(
        names
          .filter((name) => name.startsWith("orbiq-public-shell-"))
          .map(async (name) => {
            const cache = await globalThis.caches.open(name);
            return cache.keys();
          }),
      );

      return requests
        .flat()
        .map((request) => new URL(request.url).pathname)
        .sort();
    });

    expect(cachedPaths).toEqual(
      [
        "/icon.svg",
        "/icons/orbiq-192.png",
        "/icons/orbiq-512.png",
        "/icons/orbiq-apple-touch-icon.png",
        "/icons/orbiq-maskable-512.png",
        "/manifest.webmanifest",
        "/offline",
      ].sort(),
    );
    expect(cachedPaths).not.toContain("/dashboard");

    await context.setOffline(true);
    await expect(page.getByRole("status")).toContainText("Sem conexão");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Você está sem conexão" }),
    ).toBeVisible();
    await expect(page.getByText("Seus dados continuam protegidos")).toBeVisible();

    await context.setOffline(false);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
