import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  loadState,
  patchRows,
  runPostgres,
  selectRows,
  signIn,
  sqlLiteral,
} from "./support/orbiq-api";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function expectMoneyInput(locator: ReturnType<Page["locator"]>, expected: number) {
  return expect(locator).toHaveValue(new RegExp(`^${expected}(?:[,.]0+)?$`));
}

function q(value: string): string {
  return sqlLiteral(value);
}

function uuid(value: string): string {
  return `${q(value)}::uuid`;
}

test.describe("Fase 1.8B - configurações aplicadas ao produto", () => {
  test.describe.configure({ mode: "serial" });

  test("salva configurações profissionais da oficina", async ({ page }) => {
    const state = await loadState();
    await login(page, state.email, state.password);

    await page.goto("/dashboard/configuracoes");

    await page.locator('input[name="name"]').fill("Orbiq AutoQA Oficina");
    await page.locator('input[name="legal_name"]').fill("Orbiq AutoQA Ltda");
    await page.locator('input[name="cnpj"]').fill("12.345.678/0001-99");
    await page.locator('input[name="phone"]').fill("(31) 3333-4444");
    await page.locator('input[name="whatsapp"]').fill("(31) 99999-8888");
    await page.locator('input[name="email"]').fill("qa@orbiq.example.com");
    await page.locator('input[name="postal_code"]').fill("30110-000");
    await page.locator('input[name="address_line"]').fill("Avenida AutoQA");
    await page.locator('input[name="address_number"]').fill("100");
    await page.locator('input[name="address_complement"]').fill("Box 1");
    await page.locator('input[name="district"]').fill("Centro");
    await page.locator('input[name="city"]').fill("Belo Horizonte");
    await page.locator('input[name="state"]').fill("MG");
    await page.locator('input[name="quote_validity_days"]').fill("10");
    await page
      .locator('input[name="default_parts_margin_percent"]')
      .fill("35");
    await page
      .locator('textarea[name="default_quote_notes"]')
      .fill("AUTOQA: orçamento válido conforme condições da oficina.");

    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page).toHaveURL(/saved=1/);
    await expect(page.getByText("Configurações salvas com sucesso.")).toBeVisible();

    const { accessToken } = await signIn(state.email, state.password);
    const rows = await selectRows<
      Array<{
        quote_validity_days: number;
        default_parts_margin_percent: number;
        default_quote_notes: string | null;
      }>
    >(
      "organization_settings",
      `organization_id=eq.${state.organizationId}&select=quote_validity_days,default_parts_margin_percent,default_quote_notes`,
      accessToken,
    );

    expect(rows).toHaveLength(1);
    expect(Number(rows[0].quote_validity_days)).toBe(10);
    expect(Number(rows[0].default_parts_margin_percent)).toBe(35);
    expect(rows[0].default_quote_notes).toContain("AUTOQA");
  });

  test("aplica margem padrão de 35% em peça sem preço comercial", async ({
    page,
  }) => {
    const state = await loadState();
    await login(page, state.email, state.password);

    await page.goto(`/dashboard/comercial/${state.marginQuoteId}`);

    const markup = page.locator(".commercial-markup-input input");
    await expect(markup).toHaveValue(/^35(?:[,.]0+)?$/);

    const row = page.locator(".commercial-item-row").filter({
      hasText: "Coxim AutoQA",
    });

    await expect(row).toBeVisible();
    await expectMoneyInput(row.locator(".commercial-sale-input input"), 153.85);
    await expect(row).toContainText("R$ 100,00");
  });

  test("preserva preço comercial já salvo", async ({ page }) => {
    const state = await loadState();
    await login(page, state.email, state.password);

    await page.goto(`/dashboard/comercial/${state.savedQuoteId}`);

    const row = page.locator(".commercial-item-row").filter({
      hasText: "Filtro AutoQA",
    });

    await expect(row).toBeVisible();
    await expectMoneyInput(row.locator(".commercial-sale-input input"), 175);
  });

  test("versão do cliente e PDF usam identidade configurada", async ({ page }) => {
    const state = await loadState();
    await login(page, state.email, state.password);

    await page.goto(`/dashboard/comercial/${state.publicApproveQuoteId}/cliente`);

    await expect(
      page.locator(".customer-quote-brand strong").first(),
    ).toHaveText("Orbiq AutoQA Oficina");
    await expect(page.getByText("Orbiq AutoQA Ltda", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/CNPJ 12\.345\.678\/0001-99/).first()).toBeVisible();
    await expect(page.getByText(/Telefone \(31\) 3333-4444/).first()).toBeVisible();
    await expect(page.getByText(/WhatsApp \(31\) 99999-8888/).first()).toBeVisible();
    await expect(page.getByText(/qa@orbiq\.example\.com/).first()).toBeVisible();
    await expect(page.getByText(/Avenida AutoQA, 100/).first()).toBeVisible();
    await expect(page.getByText(/Validade comercial:\s*10 dias/).first()).toBeVisible();
    await expect(
      page.getByText("AUTOQA: orçamento válido conforme condições da oficina.").first(),
    ).toBeVisible();

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    expect(pdf.byteLength).toBeGreaterThan(10_000);

    await test.info().attach("orcamento-cliente-autoqa.pdf", {
      body: pdf,
      contentType: "application/pdf",
    });
  });

  test("link público criado pelo RPC respeita 10 dias e permite aprovação", async ({
    page,
  }) => {
    const state = await loadState();

    const days =
      (Date.parse(state.publicApproveExpiresAt) -
        Date.parse(state.publicApproveCreatedAt)) /
      86_400_000;

    expect(days).toBeGreaterThan(9.9);
    expect(days).toBeLessThan(10.1);

    await page.goto(`/orcamento/${state.publicApproveToken}`);
    await expect(page.getByText("Orbiq AutoQA Oficina", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Orbiq AutoQA Ltda", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Validade comercial:\s*10 dias/).first()).toBeVisible();
    await expect(page.getByText(/Link válido até/).first()).toBeVisible();
    await expect(
      page.getByText("AUTOQA: orçamento válido conforme condições da oficina.").first(),
    ).toBeVisible();
    await expect(page.getByText("Powered by Orbiq")).toBeVisible();

    await page.getByRole("button", { name: /Aprovar orçamento/ }).click();
    await expect(page.getByText(/Orçamento aprovado/).first()).toBeVisible();

    const { accessToken } = await signIn(state.email, state.password);
    const quotes = await selectRows<Array<{ commercial_status: string }>>(
      "quotes",
      `id=eq.${state.publicApproveQuoteId}&select=commercial_status`,
      accessToken,
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.commercial_status).toBe("approved");
  });

  test("link público registra reprovação e motivo", async ({ page }) => {
    const state = await loadState();

    await page.goto(`/orcamento/${state.publicRejectToken}`);
    await page.getByText("Não aprovar", { exact: true }).click();
    await page
      .locator('textarea[name="reason"]')
      .fill("AUTOQA: cliente optou por não aprovar.");
    await page.getByRole("button", { name: "Confirmar que não aprovo" }).click();

    await expect(page.getByText("Orçamento não aprovado").first()).toBeVisible();

    const { accessToken } = await signIn(state.email, state.password);
    const quotes = await selectRows<
      Array<{
        commercial_status: string;
        commercial_rejection_reason: string | null;
      }>
    >(
      "quotes",
      `id=eq.${state.publicRejectQuoteId}&select=commercial_status,commercial_rejection_reason`,
      accessToken,
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.commercial_status).toBe("rejected");
    expect(quotes[0]?.commercial_rejection_reason).toContain("AUTOQA");
  });

  test("mudança para 40% vale no próximo orçamento e não altera preço salvo", async ({
    page,
  }) => {
    const state = await loadState();
    await login(page, state.email, state.password);

    await page.goto("/dashboard/configuracoes");
    await page
      .locator('input[name="default_parts_margin_percent"]')
      .fill("40");
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page).toHaveURL(/saved=1/);

    const quoteId = randomUUID();
    const itemId = randomUUID();
    const serviceId = randomUUID();

    runPostgres(`
      begin;

      insert into public.quotes (
        id, organization_id, customer_id, vehicle_id, protocol,
        priority, status, commercial_status, mileage, created_by
      ) values (
        ${uuid(quoteId)},
        ${uuid(state.organizationId)},
        ${uuid(state.customerId)},
        ${uuid(state.vehicleId)},
        ${q(`AUTOQA-40-${Date.now()}`)},
        ${q("normal")},
        ${q("estimating")},
        ${q("draft")},
        12345,
        ${uuid(state.userId)}
      );

      insert into public.quote_services (
        id, organization_id, quote_id, category, description, needs_part, labor_amount
      ) values (
        ${uuid(serviceId)},
        ${uuid(state.organizationId)},
        ${uuid(quoteId)},
        ${q("Mecânica geral")},
        ${q("Serviço AutoQA 40%")},
        true,
        100
      );

      insert into public.quote_items (
        id, organization_id, quote_id, category, description,
        quantity, unit, supplier_id, chosen_amount, sale_unit_amount, sale_total_amount
      ) values (
        ${uuid(itemId)},
        ${uuid(state.organizationId)},
        ${uuid(quoteId)},
        ${q("Mecânica")},
        ${q("Peça AutoQA 40%")},
        1,
        ${q("un")},
        ${uuid(state.supplierId)},
        100,
        null,
        null
      );

      commit;
    `);

    const { accessToken } = await signIn(state.email, state.password);

    try {
      await page.goto(`/dashboard/comercial/${quoteId}`);
      await expect(page.locator(".commercial-markup-input input")).toHaveValue(
        /^40(?:[,.]0+)?$/,
      );

      const row = page.locator(".commercial-item-row").filter({
        hasText: "Peça AutoQA 40%",
      });

      await expect(row).toBeVisible();
      await expectMoneyInput(row.locator(".commercial-sale-input input"), 166.67);

      await page.goto(`/dashboard/comercial/${state.savedQuoteId}`);
      const savedRow = page.locator(".commercial-item-row").filter({
        hasText: "Filtro AutoQA",
      });
      await expectMoneyInput(savedRow.locator(".commercial-sale-input input"), 175);
    } finally {
      await patchRows(
        "organization_settings",
        `organization_id=eq.${state.organizationId}`,
        { default_parts_margin_percent: 35 },
        accessToken,
      );
    }
  });
});
