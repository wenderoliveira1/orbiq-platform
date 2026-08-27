import { expect, test, type Page } from "@playwright/test";

import { loadState } from "./support/orbiq-api";

type ReleaseInfo = {
  channel: "local" | "ci" | "preview" | "production";
  commit: string;
  release: string;
  service: "orbiq-web";
  version: string;
};

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Fase 2.0J - proveniência e identidade de release", () => {
  test("publica somente metadados seguros e estáveis da versão", async ({ request }) => {
    const response = await request.get("/api/release");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");

    const payload = (await response.json()) as ReleaseInfo;

    expect(payload.service).toBe("orbiq-web");
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(payload.release).toMatch(/^[a-zA-Z0-9._-]{1,64}$/);
    expect(payload.channel).toMatch(/^(local|ci|preview|production)$/);
    expect(payload.commit).toMatch(/^(local|[0-9a-f]{7,12})$/);

    const raw = JSON.stringify(payload).toLowerCase();
    expect(raw).not.toContain("service_role");
    expect(raw).not.toContain("sb_secret_");
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("supabase_publishable_key");
  });

  test("diagnóstico seguro identifica exatamente a release sem expor a conta", async ({
    page,
  }) => {
    const state = await loadState();
    await login(page, state.email, state.password);
    await page.goto("/dashboard/suporte");

    const releaseCheck = page.locator('[data-orbiq-diagnostic="release"]');
    await expect(releaseCheck).toHaveAttribute("data-status", "ok");
    await expect(releaseCheck).toContainText("Identidade da versão");

    const report = page.locator("[data-orbiq-safe-report]");
    await expect(report).toContainText(/^ORBIQ — DIAGNÓSTICO SEGURO/m);
    await expect(report).toContainText(/^release=orbiq-/m);
    await expect(report).toContainText(/^versao=\d+\.\d+\.\d+$/m);
    await expect(report).toContainText(/^commit=(local|[0-9a-f]{7,12})$/m);
    await expect(report).toContainText(/^canal=(local|ci|preview|production)$/m);
    await expect(report).toContainText(/^release=ok$/m);

    const safeText = await report.innerText();
    expect(safeText).not.toContain(state.email);
    expect(safeText).not.toContain(state.password);
    expect(safeText).not.toContain(state.organizationId);
    expect(safeText).not.toContain(state.customerId);
    expect(safeText).not.toContain(state.vehicleId);
  });
});
