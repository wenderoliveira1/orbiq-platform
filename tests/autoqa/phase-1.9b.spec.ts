import { expect, test, type Page } from "@playwright/test";

import {
  runPostgres,
  selectRows,
  signIn,
  signUp,
  sqlLiteral,
} from "./support/orbiq-api";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = `orbiq.multi.${suffix}@example.com`;
const password = "OrbiqQA!2026";

const workshopA = `AutoQA Matriz ${suffix}`;
const workshopB = `AutoQA Filial ${suffix}`;
const workshopForeign = `AutoQA Externa ${suffix}`;

const slugA = `autoqa-matriz-${suffix}`;
const slugB = `autoqa-filial-${suffix}`;
const slugForeign = `autoqa-externa-${suffix}`;

let userId = "";
let organizationAId = "";
let organizationBId = "";
let foreignOrganizationId = "";

function q(value: string): string {
  return sqlLiteral(value);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function activeWorkshop(page: Page) {
  return page.getByLabel("Oficina ativa", { exact: true });
}

function createMultiOrganizationFixture() {
  const payload = runPostgres(`
    with account as (
      select id
      from auth.users
      where email = ${q(email)}
      limit 1
    ),
    organization_a as (
      insert into public.organizations (
        name,
        slug,
        cnpj,
        created_at
      )
      values (
        ${q(workshopA)},
        ${q(slugA)},
        '11.111.111/0001-11',
        now() - interval '2 minutes'
      )
      returning id
    ),
    organization_b as (
      insert into public.organizations (
        name,
        slug,
        cnpj,
        created_at
      )
      values (
        ${q(workshopB)},
        ${q(slugB)},
        '22.222.222/0001-22',
        now() - interval '1 minute'
      )
      returning id
    ),
    organization_foreign as (
      insert into public.organizations (
        name,
        slug,
        cnpj
      )
      values (
        ${q(workshopForeign)},
        ${q(slugForeign)},
        '33.333.333/0001-33'
      )
      returning id
    ),
    membership_a as (
      insert into public.organization_members (
        organization_id,
        user_id,
        role,
        status,
        created_at
      )
      select
        organization_a.id,
        account.id,
        'owner',
        'active',
        now() - interval '2 minutes'
      from organization_a, account
      returning organization_id
    ),
    membership_b as (
      insert into public.organization_members (
        organization_id,
        user_id,
        role,
        status,
        created_at
      )
      select
        organization_b.id,
        account.id,
        'manager',
        'active',
        now() - interval '1 minute'
      from organization_b, account
      returning organization_id
    ),
    settings_a as (
      insert into public.organization_settings (
        organization_id,
        legal_name,
        city,
        state
      )
      select
        organization_a.id,
        ${q(`${workshopA} Ltda`)},
        'Belo Horizonte',
        'MG'
      from organization_a
      returning organization_id
    ),
    settings_b as (
      insert into public.organization_settings (
        organization_id,
        legal_name,
        city,
        state
      )
      select
        organization_b.id,
        ${q(`${workshopB} Ltda`)},
        'Contagem',
        'MG'
      from organization_b
      returning organization_id
    ),
    customer_a as (
      insert into public.customers (
        organization_id,
        name,
        phone
      )
      select
        organization_a.id,
        'Cliente Exclusivo Matriz',
        '(31) 99999-1001'
      from organization_a
      returning id
    ),
    customer_b as (
      insert into public.customers (
        organization_id,
        name,
        phone
      )
      select
        organization_b.id,
        'Cliente Exclusivo Filial',
        '(31) 99999-2002'
      from organization_b
      returning id
    ),
    customer_foreign as (
      insert into public.customers (
        organization_id,
        name,
        phone
      )
      select
        organization_foreign.id,
        'Cliente Oficina Externa',
        '(31) 99999-3003'
      from organization_foreign
      returning id
    )
    select json_build_object(
      'userId', account.id,
      'organizationAId', organization_a.id,
      'organizationBId', organization_b.id,
      'foreignOrganizationId', organization_foreign.id
    )::text
    from
      account,
      organization_a,
      organization_b,
      organization_foreign,
      membership_a,
      membership_b,
      settings_a,
      settings_b,
      customer_a,
      customer_b,
      customer_foreign;
  `);

  return JSON.parse(payload) as {
    userId: string;
    organizationAId: string;
    organizationBId: string;
    foreignOrganizationId: string;
  };
}

test.describe("Fase 1.9B - contexto multiempresa", () => {
  test.describe.configure({ mode: "serial" });

  test("conta com duas oficinas inicia em contexto determinístico", async ({
    page,
  }) => {
    const signup = await signUp(email, password);
    userId = signup.userId;

    const fixture = createMultiOrganizationFixture();
    organizationAId = fixture.organizationAId;
    organizationBId = fixture.organizationBId;
    foreignOrganizationId = fixture.foreignOrganizationId;

    expect(fixture.userId).toBe(userId);

    await login(page);

    const switcher = activeWorkshop(page);
    await expect(switcher).toHaveValue(organizationAId);
    await expect(
      switcher.locator(`option[value="${organizationAId}"]`),
    ).toHaveText(workshopA);
    await expect(
      switcher.locator(`option[value="${organizationBId}"]`),
    ).toHaveText(workshopB);

    await expect(page.getByText("Proprietário · troque a oficina acima")).toBeVisible();
    await expect(page.getByRole("link", { name: "Configurações" })).toBeVisible();

    await page.goto("/dashboard/clientes");
    await expect(page.getByText("Cliente Exclusivo Matriz", { exact: true })).toBeVisible();
    await expect(page.getByText("Cliente Exclusivo Filial", { exact: true })).toHaveCount(0);
  });

  test("troca A para B altera dados e RBAC e persiste após reload", async ({
    page,
  }) => {
    await login(page);

    const switcher = activeWorkshop(page);
    await expect(switcher).toHaveValue(organizationAId);

    await switcher.selectOption(organizationBId);
    await expect(page).toHaveURL(/organization_switched=1/);

    const switched = activeWorkshop(page);
    await expect(switched).toHaveValue(organizationBId);
    await expect(page.getByText("Gerente · troque a oficina acima")).toBeVisible();
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);

    await page.goto("/dashboard/clientes");
    await expect(page.getByText("Cliente Exclusivo Filial", { exact: true })).toBeVisible();
    await expect(page.getByText("Cliente Exclusivo Matriz", { exact: true })).toHaveCount(0);

    await page.reload();
    await expect(activeWorkshop(page)).toHaveValue(organizationBId);
    await expect(page.getByText("Cliente Exclusivo Filial", { exact: true })).toBeVisible();
  });

  test("seleção forjada de oficina sem vínculo é recusada e não troca o contexto", async ({
    page,
  }) => {
    await login(page);

    const legitimateSwitcher = activeWorkshop(page);
    await expect(legitimateSwitcher).toHaveValue(organizationAId);
    await legitimateSwitcher.selectOption(organizationBId);
    await expect(page).toHaveURL(/organization_switched=1/);
    await expect(activeWorkshop(page)).toHaveValue(organizationBId);

    await activeWorkshop(page).evaluate(
      (node, targetId) => {
        const select = node as HTMLSelectElement;
        const option = document.createElement("option");
        option.value = String(targetId);
        option.textContent = "Oficina forjada";
        select.append(option);
        select.value = String(targetId);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      },
      foreignOrganizationId,
    );

    await expect(page).toHaveURL(/organization_error=/);
    await expect(activeWorkshop(page)).toHaveValue(organizationBId);

    await page.goto("/dashboard/clientes");
    await expect(page.getByText("Cliente Exclusivo Filial", { exact: true })).toBeVisible();
    await expect(page.getByText("Cliente Oficina Externa", { exact: true })).toHaveCount(0);
  });

  test("RLS continua bloqueando a oficina externa mesmo com UUID conhecido", async () => {
    const session = await signIn(email, password);

    const organizations = await selectRows<Array<{ id: string }>>(
      "organizations",
      `select=id&id=eq.${foreignOrganizationId}`,
      session.accessToken,
    );

    const customers = await selectRows<Array<{ id: string }>>(
      "customers",
      `select=id&organization_id=eq.${foreignOrganizationId}`,
      session.accessToken,
    );

    expect(organizations).toEqual([]);
    expect(customers).toEqual([]);
  });
});
