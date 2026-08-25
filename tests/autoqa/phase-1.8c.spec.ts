import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  autoQaEnv,
  loadState,
  runPostgres,
  signIn,
  sqlLiteral,
} from "./support/orbiq-api";

const BRAND_COLOR = "#0B5FFF";
const BRAND_TAGLINE = "AUTOQA: excelência automotiva em cada detalhe";

const logoPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function storageUrl(path: string): string {
  const { url } = autoQaEnv();
  const encoded = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${url}/storage/v1/object/public/organization-branding/${encoded}`;
}

async function readManifest(organizationId: string) {
  const response = await fetch(
    storageUrl(`${organizationId}/branding.json`),
    { cache: "no-store" },
  );

  expect(response.status).toBe(200);

  return (await response.json()) as {
    version: number;
    logoPath: string | null;
    primaryColor: string;
    tagline: string | null;
  };
}

function q(value: string): string {
  return sqlLiteral(value);
}


test.describe("Fase 1.8C - identidade visual da oficina", () => {
  test.describe.configure({ mode: "serial" });

  test("proprietário publica logo, cor e assinatura com validação real do Storage", async ({
    page,
  }) => {
    const state = await loadState();
    await login(page, state.email, state.password);
    await page.goto("/dashboard/configuracoes");

    await page.locator('input[name="brand_primary_color"]').fill(BRAND_COLOR);
    await page.locator('input[name="brand_tagline"]').fill(BRAND_TAGLINE);
    await page.locator('input[name="logo"]').setInputFiles({
      name: "orbiq-autoqa-logo.png",
      mimeType: "image/png",
      buffer: logoPng,
    });

    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page).toHaveURL(/saved=1/);
    await expect(page.getByText("Configurações salvas com sucesso.")).toBeVisible();

    const manifest = await readManifest(state.organizationId);

    expect(manifest.version).toBe(1);
    expect(manifest.primaryColor).toBe(BRAND_COLOR);
    expect(manifest.tagline).toBe(BRAND_TAGLINE);
    expect(manifest.logoPath).toMatch(
      new RegExp(`^${state.organizationId}/logo-\\d+\\.png$`),
    );

    const logoResponse = await fetch(storageUrl(manifest.logoPath!));
    expect(logoResponse.status).toBe(200);
    expect(logoResponse.headers.get("content-type")).toContain("image/png");

    await page.reload();
    await expect(page.getByTestId("settings-logo-preview")).toHaveCSS(
      "background-image",
      /organization-branding/,
    );
    await expect(page.getByText(BRAND_TAGLINE, { exact: true })).toBeVisible();
  });

  test("versão do cliente e PDF usam a marca da própria oficina", async ({ page }) => {
    const state = await loadState();
    await login(page, state.email, state.password);

    await page.goto(`/dashboard/comercial/${state.savedQuoteId}/cliente`);
    await page.waitForLoadState("networkidle");

    const logo = page.getByTestId("workshop-logo");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveCSS("background-image", /organization-branding/);
    await expect(page.getByText(BRAND_TAGLINE, { exact: true })).toBeVisible();
    await expect(page.getByText("Orbiq AutoQA Oficina", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Powered by Orbiq", { exact: true })).toBeVisible();

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    expect(pdf.byteLength).toBeGreaterThan(10_000);

    await test.info().attach("orcamento-identidade-1.8c.pdf", {
      body: pdf,
      contentType: "application/pdf",
    });
  });

  test("link público mostra a identidade sem autenticação e mantém Powered by Orbiq", async ({
    page,
  }) => {
    const state = await loadState();

    await page.goto(`/orcamento/${state.publicApproveToken}`);
    await page.waitForLoadState("networkidle");

    const logo = page.getByTestId("workshop-logo");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveCSS("background-image", /organization-branding/);
    await expect(page.getByText(BRAND_TAGLINE, { exact: true })).toBeVisible();
    await expect(page.getByText("Orbiq AutoQA Oficina", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Powered by Orbiq", { exact: true })).toBeVisible();
  });

  test("Storage bloqueia tentativa de gravar identidade em outra oficina", async () => {
    const state = await loadState();
    const { accessToken } = await signIn(state.email, state.password);
    const { url, publicKey } = autoQaEnv();
    const foreignOrganizationId = randomUUID();
    const foreignPath = `${foreignOrganizationId}/intrusion.png`;

    const response = await fetch(
      `${url}/storage/v1/object/organization-branding/${foreignPath}`,
      {
        method: "POST",
        headers: {
          apikey: publicKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "image/png",
          "x-upsert": "false",
        },
        body: logoPng,
      },
    );

    expect(response.ok).toBe(false);
    expect([400, 401, 403]).toContain(response.status);

    const leakedObjectCount = Number(
      runPostgres(`
        select count(*)
        from storage.objects
        where bucket_id = 'organization-branding'
          and name = ${q(foreignPath)};
      `),
    );

    expect(leakedObjectCount).toBe(0);
  });

  test("remoção da logo limpa o objeto antigo e mantém cor e assinatura", async ({ page }) => {
    const state = await loadState();
    const before = await readManifest(state.organizationId);

    expect(before.logoPath).not.toBeNull();

    await login(page, state.email, state.password);
    await page.goto("/dashboard/configuracoes");

    await page.locator('input[name="remove_logo"]').check();
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page).toHaveURL(/saved=1/);

    const after = await readManifest(state.organizationId);
    expect(after.logoPath).toBeNull();
    expect(after.primaryColor).toBe(BRAND_COLOR);
    expect(after.tagline).toBe(BRAND_TAGLINE);

    const oldObjectCount = Number(
      runPostgres(`
        select count(*)
        from storage.objects
        where bucket_id = 'organization-branding'
          and name = ${q(before.logoPath!)};
      `),
    );

    expect(oldObjectCount).toBe(0);

    await page.reload();
    const preview = page.getByTestId("settings-logo-preview");
    await expect(preview).toHaveCSS("background-image", "none");
    await expect(preview).toHaveCSS("background-color", "rgb(11, 95, 255)");
  });
});
