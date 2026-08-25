import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  rpc,
  runPostgres,
  signIn,
  signUp,
  sqlLiteral,
} from "./support/orbiq-api";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const password = "OrbiqQA!2026";
const ownerEmail = `orbiq.branches.owner.${suffix}@example.com`;
const managerEmail = `orbiq.branches.manager.${suffix}@example.com`;
const primaryWorkshop = `AutoQA Matriz 1.9C ${suffix}`;
const newWorkshop = `AutoQA Filial 1.9C ${suffix}`;
const primarySlug = `autoqa-matriz-19c-${suffix}`;
const newSlug = `autoqa-filial-19c-${suffix}`;
const duplicateSlug = `autoqa-filial-duplicada-19c-${suffix}`;
const uniqueCnpj = "48.765.432/0001-19";

let ownerUserId = "";
let managerUserId = "";
let primaryOrganizationId = "";
let newOrganizationId = "";

function q(value: string): string {
  return sqlLiteral(value);
}

function uuid(value: string): string {
  return `${q(value)}::uuid`;
}

async function login(
  page: Page,
  email: string,
  accountPassword: string,
) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(accountPassword);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function activeWorkshop(page: Page) {
  return page.getByLabel("Oficina ativa", { exact: true });
}

function createInitialFixture() {
  primaryOrganizationId = randomUUID();

  runPostgres(`
    begin;

    insert into public.organizations (
      id,
      name,
      slug,
      cnpj
    )
    values (
      ${uuid(primaryOrganizationId)},
      ${q(primaryWorkshop)},
      ${q(primarySlug)},
      null
    );

    insert into public.organization_members (
      organization_id,
      user_id,
      role,
      status
    )
    values
      (
        ${uuid(primaryOrganizationId)},
        ${uuid(ownerUserId)},
        'owner',
        'active'
      ),
      (
        ${uuid(primaryOrganizationId)},
        ${uuid(managerUserId)},
        'manager',
        'active'
      );

    insert into public.organization_settings (
      organization_id,
      legal_name,
      phone,
      email,
      city,
      state
    )
    values (
      ${uuid(primaryOrganizationId)},
      ${q(`${primaryWorkshop} Ltda`)},
      '(31) 3333-1900',
      ${q(ownerEmail)},
      'Belo Horizonte',
      'MG'
    );

    insert into public.customers (
      organization_id,
      name,
      phone,
      created_by
    )
    values (
      ${uuid(primaryOrganizationId)},
      'Cliente Exclusivo Matriz 1.9C',
      '(31) 99999-1900',
      ${uuid(ownerUserId)}
    );

    commit;
  `);
}

function additionalOrganizationArgs(
  slug = newSlug,
  cnpj = uniqueCnpj,
) {
  return {
    organization_name: newWorkshop,
    organization_slug: slug,
    organization_cnpj: cnpj,
    organization_legal_name: `${newWorkshop} Ltda`,
    organization_phone: "(31) 3333-1910",
    organization_whatsapp: "(31) 99999-1910",
    organization_email: `filial.${suffix}@example.com`,
    organization_city: "Contagem",
    organization_state: "MG",
  };
}

test.describe("Fase 1.9C - gestão de oficinas e filiais", () => {
  test.describe.configure({ mode: "serial" });

  test("proprietário cria uma filial completa e ela se torna a oficina ativa", async ({
    page,
  }) => {
    const owner = await signUp(ownerEmail, password);
    const manager = await signUp(managerEmail, password);

    ownerUserId = owner.userId;
    managerUserId = manager.userId;
    createInitialFixture();

    await login(page, ownerEmail, password);
    await page.goto("/dashboard/oficinas");

    await expect(
      page.getByRole("heading", { name: "Oficinas e filiais" }),
    ).toBeVisible();
    await expect(activeWorkshop(page)).toHaveValue(
      primaryOrganizationId,
    );

    await page.getByLabel("NOME DA OFICINA").fill(newWorkshop);
    await page.getByLabel("IDENTIFICADOR EXCLUSIVO").fill(newSlug);
    await page.getByLabel("RAZÃO SOCIAL").fill(
      `${newWorkshop} Ltda`,
    );
    await page.getByLabel("CNPJ").fill(uniqueCnpj);
    await page
      .getByLabel("Telefone", { exact: true })
      .fill("(31) 3333-1910");
    await page
      .getByLabel("WhatsApp", { exact: true })
      .fill("(31) 99999-1910");
    await page
      .getByLabel("E-MAIL DA OFICINA")
      .fill(`filial.${suffix}@example.com`);
    await page.getByLabel("CIDADE").fill("Contagem");
    await page.getByLabel("UF").fill("MG");

    await page
      .getByRole("button", {
        name: "Criar e ativar nova oficina",
      })
      .click();

    await expect(page).toHaveURL(
      /\/dashboard\/oficinas\?created=1$/,
    );
    await expect(
      page.getByText(
        "Nova oficina criada e ativada com sucesso.",
        { exact: true },
      ),
    ).toBeVisible();

    newOrganizationId = runPostgres(`
      select id
      from public.organizations
      where slug = ${q(newSlug)}
      limit 1;
    `);

    expect(newOrganizationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    await expect(activeWorkshop(page)).toHaveValue(
      newOrganizationId,
    );

    const bootstrap = runPostgres(`
      select concat_ws(
        '|',
        (
          select role
          from public.organization_members
          where
            organization_id = ${uuid(newOrganizationId)}
            and user_id = ${uuid(ownerUserId)}
            and status = 'active'
        ),
        (
          select city || '/' || state
          from public.organization_settings
          where organization_id = ${uuid(newOrganizationId)}
        ),
        (
          select count(*)::text
          from public.supplier_categories
          where organization_id = ${uuid(newOrganizationId)}
        ),
        (
          select count(*)::text
          from public.audit_logs
          where
            organization_id = ${uuid(newOrganizationId)}
            and action = 'organization.created'
        )
      );
    `);

    const [role, location, categoryCount, auditCount] =
      bootstrap.split("|");

    expect(role).toBe("owner");
    expect(location).toBe("Contagem/MG");
    expect(Number(categoryCount)).toBeGreaterThan(0);
    expect(Number(auditCount)).toBe(1);
  });

  test("CNPJ normalizado não pode ser reutilizado", async () => {
    const session = await signIn(ownerEmail, password);

    await expect(
      rpc(
        "create_additional_organization",
        additionalOrganizationArgs(
          duplicateSlug,
          "48765432000119",
        ),
        session.accessToken,
      ),
    ).rejects.toThrow(
      /já existe uma oficina|duplicate|unique/i,
    );

    const duplicateCount = Number(
      runPostgres(`
        select count(*)
        from public.organizations
        where slug = ${q(duplicateSlug)};
      `),
    );

    expect(duplicateCount).toBe(0);
  });

  test("gerente não acessa a gestão nem força criação pelo RPC", async ({
    page,
  }) => {
    await login(page, managerEmail, password);
    await page.goto("/dashboard/oficinas");

    await expect(page).toHaveURL(
      /\/dashboard\/sem-acesso\?permission=organizations\.manage/,
    );

    const session = await signIn(managerEmail, password);

    await expect(
      rpc(
        "create_additional_organization",
        additionalOrganizationArgs(
          `autoqa-manager-blocked-${suffix}`,
          "61.234.567/0001-89",
        ),
        session.accessToken,
      ),
    ).rejects.toThrow(
      /somente um proprietário|permission|42501/i,
    );

    const blockedCount = Number(
      runPostgres(`
        select count(*)
        from public.organizations
        where slug = ${q(`autoqa-manager-blocked-${suffix}`)};
      `),
    );

    expect(blockedCount).toBe(0);
  });

  test("dados da matriz e da filial continuam isolados ao alternar", async ({
    page,
  }) => {
    await login(page, ownerEmail, password);

    await expect(activeWorkshop(page)).toHaveValue(
      primaryOrganizationId,
    );
    await page.goto("/dashboard/clientes");
    await expect(
      page.getByText("Cliente Exclusivo Matriz 1.9C", {
        exact: true,
      }),
    ).toBeVisible();

    await activeWorkshop(page).selectOption(
      newOrganizationId,
    );
    await expect(activeWorkshop(page)).toHaveValue(
      newOrganizationId,
    );
    await page.goto("/dashboard/clientes");

    await expect(
      page.getByText("Cliente Exclusivo Matriz 1.9C", {
        exact: true,
      }),
    ).toHaveCount(0);
  });
});
