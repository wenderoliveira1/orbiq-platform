import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0G - atualizações seguras do PWA", () => {
  test("mantém a nova versão aguardando confirmação explícita do usuário", async ({
    request,
  }) => {
    const response = await request.get("/sw.js");
    const source = await response.text();

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("javascript");
    expect(source).toContain('const CACHE_NAME = `${CACHE_PREFIX}public-shell-v3`;');
    expect(source).toContain('const SKIP_WAITING_MESSAGE = "ORBIQ_SKIP_WAITING";');
    expect(source).toContain("event.waitUntil(globalThis.skipWaiting());");

    const installStart = source.indexOf('globalThis.addEventListener("install"');
    const activateStart = source.indexOf('globalThis.addEventListener("activate"');
    const installBlock = source.slice(installStart, activateStart);

    expect(installStart).toBeGreaterThanOrEqual(0);
    expect(activateStart).toBeGreaterThan(installStart);
    expect(installBlock).not.toContain("skipWaiting");
  });

  test("não interrompe a sessão normal e mantém atualização explícita e responsiva", async ({
    page,
  }) => {
    const registrationSource = readFileSync(
      resolve("apps/web/src/app/pwa-registration.tsx"),
      "utf8",
    );
    const registrationCss = readFileSync(
      resolve("apps/web/src/app/pwa-registration.module.css"),
      "utf8",
    );

    expect(registrationSource).toContain(
      "const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;",
    );
    expect(registrationSource).toContain(
      'document.addEventListener("visibilitychange", handleVisibilityChange);',
    );
    expect(registrationSource).toContain(
      'window.addEventListener("online", checkForUpdate);',
    );
    expect(registrationSource).toContain(
      'navigator.serviceWorker.addEventListener(\n          "controllerchange",\n          handleControllerChange,\n        );',
    );
    expect(registrationSource).toContain("if (!reloadRequested.current)");
    expect(registrationSource).toContain("window.location.reload();");
    expect(registrationSource).toContain("reloadRequested.current = true;");
    expect(registrationSource).toContain(
      "waiting.postMessage({ type: SKIP_WAITING_MESSAGE });",
    );
    expect(registrationSource).toContain("Nova versão disponível");
    expect(registrationSource).toContain("Depois");
    expect(registrationSource).toContain("Atualizar agora");
    expect(registrationSource).toContain(
      "Salve qualquer edição em andamento antes de atualizar.",
    );
    expect(registrationCss).toContain("@media (max-width: 820px)");
    expect(registrationCss).toContain("@media (max-width: 480px)");
    expect(registrationCss).toContain("@media print");

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/instalar");

    // Sem worker aguardando, a sessão atual não deve sofrer aviso falso nem reload.
    await expect(page.locator("[data-orbiq-pwa-update]")).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
