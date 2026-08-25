import { expect, test, type Page } from "@playwright/test";

import {
  runPostgres,
  selectRows,
  signUp,
  sqlLiteral,
} from "./support/orbiq-api";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const ownerEmail = `orbiq.onboarding.${suffix}@example.com`;
const ownerPassword = "OrbiqQA!2026";
const workshopName = `Oficina Onboarding ${suffix}`;
const workshopSlug = `oficina-onboarding-${suffix}`;
const workshopCnpj = "12.345.678/0001-90";

let organizationId = "";

function q(value: string): string {
  return sqlLiteral(value);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ownerEmail);
  await page.getByLabel("Senha").fill(ownerPassword);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
}

test.describe("Fase 1.9A - onboarding profissional da oficina", () => {
  test.describe.configure({ mode: "serial" });

  test("novo proprietário cria a oficina e não consegue pular a configuração inicial", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByLabel("Nome").fill("Orbiq Onboarding Owner");
    await page.getByLabel("E-mail").fill(ownerEmail);
    await page.getByLabel("Senha").fill(ownerPassword);
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByRole("heading", { name: "Crie sua oficina" }),
    ).toBeVisible();

    await page.getByLabel("Nome da oficina").fill(workshopName);
    await page.getByLabel("Identificador").fill(workshopSlug);
    await page.getByLabel(/CNPJ/).fill(workshopCnpj);
    await page
      .getByRole("button", { name: "Criar oficina e continuar" })
      .click();

    await expect(page).toHaveURL(/\/onboarding\?.*step=profile/);
    await expect(
      page.getByRole("heading", { name: "Complete o perfil da oficina" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Oficina criada. Agora conclua os dados essenciais da operação.",
      ),
    ).toBeVisible();

    organizationId = runPostgres(`
      select membership.organization_id::text
      from auth.users as account
      join public.organization_members as membership
        on membership.user_id = account.id
      where account.email = ${q(ownerEmail)}
        and membership.status = 'active'
      limit 1;
    `);

    expect(organizationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const settingsCount = Number(
      runPostgres(`
        select count(*)
        from public.organization_settings
        where organization_id = ${q(organizationId)}::uuid;
      `),
    );

    expect(settingsCount).toBe(0);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding\?step=profile/);
    await expect(
      page.getByRole("heading", { name: "Complete o perfil da oficina" }),
    ).toBeVisible();
  });

  test("configuração inicial grava perfil e padrões comerciais e libera o dashboard", async ({
    page,
  }) => {
    await login(page);
    await expect(page).toHaveURL(/\/onboarding\?step=profile/);

    await page.getByLabel("Razão social").fill("Orbiq AutoQA Serviços Ltda");
    await page.getByLabel("E-mail da oficina").fill("contato@autoqa.example.com");
    await page.getByLabel("WhatsApp").fill("(31) 99999-0101");
    await page.getByLabel("CEP").fill("30110-000");
    await page.getByLabel("Logradouro").fill("Avenida AutoQA");
    await page.getByLabel("Número").fill("190");
    await page.getByLabel("Bairro").fill("Centro");
    await page.getByLabel("Cidade").fill("Belo Horizonte");
    await page.getByLabel("UF").fill("mg");
    await page.getByLabel("Validade padrão do orçamento").fill("12");
    await page.getByLabel("Margem padrão das peças (%)").fill("32.5");
    await page
      .getByLabel("Observação padrão do orçamento")
      .fill("AUTOQA onboarding profissional concluído.");

    await page
      .getByRole("button", {
        name: "Concluir configuração e entrar no Orbiq",
      })
      .click();

    await expect(page).toHaveURL(/\/dashboard(?:\?welcome=1)?$/);

    const settings = JSON.parse(
      runPostgres(`
        select json_build_object(
          'legal_name', legal_name,
          'whatsapp', whatsapp,
          'email', email,
          'postal_code', postal_code,
          'address_line', address_line,
          'address_number', address_number,
          'district', district,
          'city', city,
          'state', state,
          'validity', quote_validity_days,
          'margin', default_parts_margin_percent,
          'notes', default_quote_notes
        )::text
        from public.organization_settings
        where organization_id = ${q(organizationId)}::uuid;
      `),
    ) as Record<string, string | number>;

    expect(settings).toMatchObject({
      legal_name: "Orbiq AutoQA Serviços Ltda",
      whatsapp: "(31) 99999-0101",
      email: "contato@autoqa.example.com",
      postal_code: "30110-000",
      address_line: "Avenida AutoQA",
      address_number: "190",
      district: "Centro",
      city: "Belo Horizonte",
      state: "MG",
      validity: 12,
      margin: 32.5,
      notes: "AUTOQA onboarding profissional concluído.",
    });
  });

  test("dados do onboarding aparecem em Configurações sem intervenção técnica", async ({
    page,
  }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/dashboard/configuracoes");

    await expect(page.locator('input[name="legal_name"]')).toHaveValue(
      "Orbiq AutoQA Serviços Ltda",
    );
    await expect(page.locator('input[name="whatsapp"]')).toHaveValue(
      "(31) 99999-0101",
    );
    await expect(page.locator('input[name="city"]')).toHaveValue(
      "Belo Horizonte",
    );
    await expect(page.locator('input[name="state"]')).toHaveValue("MG");
    await expect(
      page.locator('input[name="quote_validity_days"]'),
    ).toHaveValue("12");
    await expect(
      page.locator('input[name="default_parts_margin_percent"]'),
    ).toHaveValue("32.5");
  });

  test("usuário de outra conta não consegue enxergar a oficina criada no onboarding", async () => {
    const foreignEmail = `orbiq.foreign.${suffix}@example.com`;
    const foreign = await signUp(foreignEmail, ownerPassword);

    const rows = await selectRows<Array<{ id: string }>>(
      "organizations",
      `select=id&id=eq.${organizationId}`,
      foreign.accessToken,
    );

    expect(rows).toEqual([]);
  });
});
