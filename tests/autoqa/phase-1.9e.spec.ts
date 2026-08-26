import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  rpc,
  runPostgres,
  signIn,
  signUp,
  sqlLiteral,
} from "./support/orbiq-api";

type NetworkActivityRow = {
  action: string;
  organization_id: string;
  organization_name: string;
  total_count: number;
};

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const password = "OrbiqQA!2026";

const ownerEmail = `orbiq.governance.owner.${suffix}@example.com`;
const managerEmail = `orbiq.governance.manager.${suffix}@example.com`;
const externalOwnerEmail = `orbiq.governance.external.${suffix}@example.com`;

const primaryName = `AutoQA Governança Matriz ${suffix}`;
const branchName = `AutoQA Governança Filial ${suffix}`;
const externalName = `AutoQA Governança Externa ${suffix}`;

const primarySlug = `autoqa-governanca-matriz-${suffix}`;
const branchSlug = `autoqa-governanca-filial-${suffix}`;
const externalSlug = `autoqa-governanca-externa-${suffix}`;

const primaryOrganizationId = randomUUID();
const branchOrganizationId = randomUUID();
const externalOrganizationId = randomUUID();

const primaryCustomerId = randomUUID();
const branchCustomerId = randomUUID();
const externalCustomerId = randomUUID();

const primaryVehicleId = randomUUID();
const branchVehicleId = randomUUID();
const externalVehicleId = randomUUID();

const primaryQuoteId = randomUUID();
const branchQuoteId = randomUUID();
const externalQuoteId = randomUUID();

let ownerUserId = "";
let managerUserId = "";
let externalOwnerUserId = "";

function q(value: string): string {
  return sqlLiteral(value);
}

function uuid(value: string): string {
  return `${q(value)}::uuid`;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function createFixture() {
  runPostgres(`
    begin;

    delete from public.organizations
    where slug in (${q(primarySlug)}, ${q(branchSlug)}, ${q(externalSlug)});

    insert into public.organizations (id, name, slug)
    values
      (${uuid(primaryOrganizationId)}, ${q(primaryName)}, ${q(primarySlug)}),
      (${uuid(branchOrganizationId)}, ${q(branchName)}, ${q(branchSlug)}),
      (${uuid(externalOrganizationId)}, ${q(externalName)}, ${q(externalSlug)});

    insert into public.organization_members (
      organization_id,
      user_id,
      role,
      status,
      created_at
    )
    values
      (${uuid(primaryOrganizationId)}, ${uuid(ownerUserId)}, 'owner', 'active', now() - interval '4 minutes'),
      (${uuid(branchOrganizationId)}, ${uuid(ownerUserId)}, 'owner', 'active', now() - interval '3 minutes'),
      (${uuid(primaryOrganizationId)}, ${uuid(managerUserId)}, 'manager', 'active', now() - interval '2 minutes'),
      (${uuid(externalOrganizationId)}, ${uuid(externalOwnerUserId)}, 'owner', 'active', now() - interval '1 minute');

    insert into public.organization_settings (
      organization_id,
      legal_name,
      email,
      city,
      state
    )
    values
      (${uuid(primaryOrganizationId)}, ${q(primaryName + " Ltda")}, ${q(ownerEmail)}, 'Belo Horizonte', 'MG'),
      (${uuid(branchOrganizationId)}, ${q(branchName + " Ltda")}, ${q(ownerEmail)}, 'Contagem', 'MG'),
      (${uuid(externalOrganizationId)}, ${q(externalName + " Ltda")}, ${q(externalOwnerEmail)}, 'Betim', 'MG');

    insert into public.customers (id, organization_id, name, created_by)
    values
      (${uuid(primaryCustomerId)}, ${uuid(primaryOrganizationId)}, 'Cliente Governança Matriz', ${uuid(ownerUserId)}),
      (${uuid(branchCustomerId)}, ${uuid(branchOrganizationId)}, 'Cliente Governança Filial', ${uuid(ownerUserId)}),
      (${uuid(externalCustomerId)}, ${uuid(externalOrganizationId)}, 'Cliente Governança Externa', ${uuid(externalOwnerUserId)});

    insert into public.vehicles (
      id,
      organization_id,
      customer_id,
      plate,
      brand,
      model
    )
    values
      (${uuid(primaryVehicleId)}, ${uuid(primaryOrganizationId)}, ${uuid(primaryCustomerId)}, 'GOV1A01', 'Orbiq', 'Matriz'),
      (${uuid(branchVehicleId)}, ${uuid(branchOrganizationId)}, ${uuid(branchCustomerId)}, 'GOV1A02', 'Orbiq', 'Filial'),
      (${uuid(externalVehicleId)}, ${uuid(externalOrganizationId)}, ${uuid(externalCustomerId)}, 'GOV1A03', 'Orbiq', 'Externa');

    insert into public.quotes (
      id,
      organization_id,
      customer_id,
      vehicle_id,
      protocol,
      priority,
      status,
      commercial_status,
      created_by
    )
    values
      (${uuid(primaryQuoteId)}, ${uuid(primaryOrganizationId)}, ${uuid(primaryCustomerId)}, ${uuid(primaryVehicleId)}, ${q("GOV-M-" + suffix)}, 'normal', 'estimating', 'draft', ${uuid(ownerUserId)}),
      (${uuid(branchQuoteId)}, ${uuid(branchOrganizationId)}, ${uuid(branchCustomerId)}, ${uuid(branchVehicleId)}, ${q("GOV-F-" + suffix)}, 'normal', 'estimating', 'draft', ${uuid(ownerUserId)}),
      (${uuid(externalQuoteId)}, ${uuid(externalOrganizationId)}, ${uuid(externalCustomerId)}, ${uuid(externalVehicleId)}, ${q("GOV-X-" + suffix)}, 'normal', 'estimating', 'draft', ${uuid(externalOwnerUserId)});

    insert into public.audit_logs (
      organization_id,
      actor_user_id,
      actor_type,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at
    )
    values
      (${uuid(primaryOrganizationId)}, ${uuid(ownerUserId)}, 'user', 'team.invite_created', 'organization_invite', ${uuid(randomUUID())}, jsonb_build_object('email', 'novo.matriz@example.com', 'role', 'estimator'), now() - interval '2 minutes'),
      (${uuid(branchOrganizationId)}, ${uuid(ownerUserId)}, 'user', 'team.member_role_changed', 'organization_member', ${uuid(ownerUserId)}, jsonb_build_object('from', 'manager', 'to', 'admin'), now() - interval '1 minute'),
      (${uuid(externalOrganizationId)}, ${uuid(externalOwnerUserId)}, 'user', 'team.invite_created', 'organization_invite', ${uuid(randomUUID())}, jsonb_build_object('email', 'segredo.externo@example.com', 'role', 'manager'), now());

    commit;
  `);
}

test.describe("Fase 1.9E - governança e auditoria da rede", () => {
  test.describe.configure({ mode: "serial" });

  test("proprietário audita suas oficinas, filtra governança e abre o evento", async ({ page }) => {
    const owner = await signUp(ownerEmail, password);
    const manager = await signUp(managerEmail, password);
    const externalOwner = await signUp(externalOwnerEmail, password);

    ownerUserId = owner.userId;
    managerUserId = manager.userId;
    externalOwnerUserId = externalOwner.userId;

    createFixture();
    await login(page, ownerEmail);
    await page.goto("/dashboard/rede/atividade?periodo=90");

    await expect(page.getByRole("heading", { name: "Auditoria consolidada da rede" })).toBeVisible();
    const mainNavigation = page.getByRole("navigation", {
      name: "Navegação principal",
    });

    await expect(
      mainNavigation.getByRole("link", { name: "Governança", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      mainNavigation.getByRole("link", { name: "Visão da rede", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");

    const activityRegion = page.getByRole("region", {
      name: "Atividades da rede",
    });

    await expect(activityRegion.getByText(primaryName, { exact: true }).first()).toBeVisible();
    await expect(activityRegion.getByText(branchName, { exact: true }).first()).toBeVisible();
    await expect(activityRegion.getByText(externalName, { exact: true })).toHaveCount(0);
    await expect(activityRegion.getByText("GOV-M-" + suffix, { exact: true })).toBeVisible();
    await expect(activityRegion.getByText("GOV-F-" + suffix, { exact: true })).toBeVisible();
    await expect(activityRegion.getByText("GOV-X-" + suffix, { exact: true })).toHaveCount(0);

    await page.getByLabel("Categoria").selectOption("governance");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page).toHaveURL(/tipo=governance/);
    await expect(activityRegion.getByText("Convite de equipe criado", { exact: true })).toBeVisible();
    await expect(activityRegion.getByText("Função da equipe alterada", { exact: true })).toBeVisible();
    await expect(activityRegion.getByText("GOV-M-" + suffix, { exact: true })).toHaveCount(0);

    const session = await signIn(ownerEmail, password);
    const rows = await rpc<NetworkActivityRow[]>(
      "get_owned_network_activity",
      {
        filter_organization_id: null,
        filter_category: "governance",
        filter_period_start: new Date(Date.now() - 90 * 86400000).toISOString(),
        filter_period_end: new Date(Date.now() + 60000).toISOString(),
        filter_query: null,
        result_limit: 100,
        result_offset: 0,
      },
      session.accessToken,
    );

    expect(new Set(rows.map((row) => row.organization_id))).toEqual(
      new Set([primaryOrganizationId, branchOrganizationId]),
    );
    expect(rows.some((row) => row.organization_id === externalOrganizationId)).toBe(false);

    await expect(
      rpc(
        "get_owned_network_activity",
        {
          filter_organization_id: externalOrganizationId,
          filter_category: null,
          filter_period_start: new Date(Date.now() - 90 * 86400000).toISOString(),
          filter_period_end: new Date(Date.now() + 60000).toISOString(),
          filter_query: null,
          result_limit: 40,
          result_offset: 0,
        },
        session.accessToken,
      ),
    ).rejects.toThrow(/não pertence|42501|permission/i);
  });

  test("gerente não acessa a rota nem força a RPC da rede", async ({ page }) => {
    await login(page, managerEmail);
    await page.goto("/dashboard/rede/atividade");

    await expect(page).toHaveURL(/\/dashboard\/sem-acesso\?permission=network\.view/);
    await expect(page.getByRole("link", { name: "Governança" })).toHaveCount(0);

    const session = await signIn(managerEmail, password);
    await expect(
      rpc(
        "get_owned_network_activity",
        {
          filter_organization_id: primaryOrganizationId,
          filter_category: null,
          filter_period_start: new Date(Date.now() - 7 * 86400000).toISOString(),
          filter_period_end: new Date(Date.now() + 60000).toISOString(),
          filter_query: null,
          result_limit: 40,
          result_offset: 0,
        },
        session.accessToken,
      ),
    ).rejects.toThrow(/Somente um proprietário|42501|permission/i);
  });

  test("proprietário externo permanece isolado em sua própria rede", async ({ page }) => {
    await login(page, externalOwnerEmail);
    await page.goto("/dashboard/rede/atividade?periodo=90");

    const activityRegion = page.getByRole("region", {
      name: "Atividades da rede",
    });

    await expect(activityRegion.getByText(externalName, { exact: true }).first()).toBeVisible();
    await expect(activityRegion.getByText(primaryName, { exact: true })).toHaveCount(0);
    await expect(activityRegion.getByText(branchName, { exact: true })).toHaveCount(0);
    await expect(activityRegion.getByText("segredo.externo@example.com", { exact: false })).toBeVisible();
    await expect(activityRegion.getByText("novo.matriz@example.com", { exact: false })).toHaveCount(0);

    const session = await signIn(externalOwnerEmail, password);
    const rows = await rpc<NetworkActivityRow[]>(
      "get_owned_network_activity",
      {
        filter_organization_id: null,
        filter_category: null,
        filter_period_start: new Date(Date.now() - 90 * 86400000).toISOString(),
        filter_period_end: new Date(Date.now() + 60000).toISOString(),
        filter_query: null,
        result_limit: 100,
        result_offset: 0,
      },
      session.accessToken,
    );

    expect(new Set(rows.map((row) => row.organization_id))).toEqual(
      new Set([externalOrganizationId]),
    );
  });
});
