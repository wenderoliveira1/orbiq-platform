import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  insertRows,
  rpc,
  runPostgres,
  selectRows,
  signIn,
  signUp,
  sqlLiteral,
} from "./support/orbiq-api";

type IncidentRow = {
  fingerprint: string;
  incident_id: string;
  occurrences: number;
  organization_id: string;
  resolution_note: string | null;
  route: string;
};

type ReportRow = {
  incident_id: string;
  occurrence_count: number;
};

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const password = "OrbiqQA!2026";

const ownerEmail = `orbiq.reliability.owner.${suffix}@example.com`;
const managerEmail = `orbiq.reliability.manager.${suffix}@example.com`;
const externalOwnerEmail = `orbiq.reliability.external.${suffix}@example.com`;

const primaryName = `AutoQA Confiabilidade Matriz ${suffix}`;
const branchName = `AutoQA Confiabilidade Filial ${suffix}`;
const externalName = `AutoQA Confiabilidade Externa ${suffix}`;

const primarySlug = `autoqa-confiabilidade-matriz-${suffix}`;
const branchSlug = `autoqa-confiabilidade-filial-${suffix}`;
const externalSlug = `autoqa-confiabilidade-externa-${suffix}`;

const primaryOrganizationId = randomUUID();
const branchOrganizationId = randomUUID();
const externalOrganizationId = randomUUID();

const primaryFingerprint = `client_${randomUUID().replaceAll("-", "")}`;
const branchFingerprint = `server_${randomUUID().replaceAll("-", "")}`;
const externalFingerprint = `global_${randomUUID().replaceAll("-", "")}`;

let ownerUserId = "";
let managerUserId = "";
let externalOwnerUserId = "";
let primaryIncidentId = "";
let branchIncidentId = "";

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

    commit;
  `);
}

async function seedIncidents() {
  const managerSession = await signIn(managerEmail, password);
  const ownerSession = await signIn(ownerEmail, password);
  const externalSession = await signIn(externalOwnerEmail, password);

  const firstPrimary = await rpc<ReportRow[]>(
    "report_application_incident",
    {
      target_org_id: primaryOrganizationId,
      target_fingerprint: primaryFingerprint,
      target_source: "dashboard_error",
      target_route: "/dashboard/orcamentos/novo?cliente=nao-persistir",
    },
    managerSession.accessToken,
  );

  const repeatedPrimary = await rpc<ReportRow[]>(
    "report_application_incident",
    {
      target_org_id: primaryOrganizationId,
      target_fingerprint: primaryFingerprint,
      target_source: "dashboard_error",
      target_route: "/dashboard/orcamentos/novo?cliente=outro-segredo",
    },
    managerSession.accessToken,
  );

  const branch = await rpc<ReportRow[]>(
    "report_application_incident",
    {
      target_org_id: branchOrganizationId,
      target_fingerprint: branchFingerprint,
      target_source: "server_action",
      target_route: "/dashboard/compras",
    },
    ownerSession.accessToken,
  );

  await rpc<ReportRow[]>(
    "report_application_incident",
    {
      target_org_id: externalOrganizationId,
      target_fingerprint: externalFingerprint,
      target_source: "global_error",
      target_route: "/dashboard/configuracoes",
    },
    externalSession.accessToken,
  );

  expect(firstPrimary).toHaveLength(1);
  expect(repeatedPrimary).toEqual([
    {
      incident_id: firstPrimary[0].incident_id,
      occurrence_count: 2,
    },
  ]);

  primaryIncidentId = firstPrimary[0].incident_id;
  branchIncidentId = branch[0].incident_id;
}

test.describe("Fase 1.9F - confiabilidade e observabilidade operacional", () => {
  test.describe.configure({ mode: "serial" });

  test("proprietário acompanha, resolve e audita incidentes de toda a própria rede", async ({ page }) => {
    const owner = await signUp(ownerEmail, password);
    const manager = await signUp(managerEmail, password);
    const externalOwner = await signUp(externalOwnerEmail, password);

    ownerUserId = owner.userId;
    managerUserId = manager.userId;
    externalOwnerUserId = externalOwner.userId;

    createFixture();
    await seedIncidents();
    await login(page, ownerEmail);
    await page.goto("/dashboard/confiabilidade");

    await expect(page.getByRole("heading", { name: "Central de incidentes" })).toBeVisible();

    const mainNavigation = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    await expect(
      mainNavigation.getByRole("link", { name: "Confiabilidade", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    const incidentRegion = page.getByRole("region", {
      name: "Incidentes da aplicação",
    });
    await expect(incidentRegion.getByText(primaryName, { exact: true }).first()).toBeVisible();
    await expect(incidentRegion.getByText(branchName, { exact: true }).first()).toBeVisible();
    await expect(incidentRegion.getByText(externalName, { exact: true })).toHaveCount(0);

    const primaryCard = page.getByTestId(`incident-${primaryIncidentId}`);
    await expect(primaryCard.getByText("2 ocorrência(s)", { exact: true })).toBeVisible();
    await expect(primaryCard.getByText("/dashboard/orcamentos/novo", { exact: true })).toBeVisible();
    await expect(primaryCard).not.toContainText("nao-persistir");
    await expect(primaryCard).not.toContainText("outro-segredo");

    const ownerSession = await signIn(ownerEmail, password);
    const rows = await rpc<IncidentRow[]>(
      "get_owned_application_incidents",
      {
        filter_organization_id: null,
        filter_status: "all",
        filter_query: null,
        result_limit: 100,
        result_offset: 0,
      },
      ownerSession.accessToken,
    );

    expect(new Set(rows.map((row) => row.organization_id))).toEqual(
      new Set([primaryOrganizationId, branchOrganizationId]),
    );
    expect(rows.some((row) => row.organization_id === externalOrganizationId)).toBe(false);
    expect(rows.find((row) => row.incident_id === primaryIncidentId)).toMatchObject({
      occurrences: 2,
      route: "/dashboard/orcamentos/novo",
    });

    await expect(
      rpc(
        "get_owned_application_incidents",
        {
          filter_organization_id: externalOrganizationId,
          filter_status: "all",
          filter_query: null,
          result_limit: 100,
          result_offset: 0,
        },
        ownerSession.accessToken,
      ),
    ).rejects.toThrow(/não pertence|42501|permission/i);

    await expect(
      insertRows(
        "application_incidents",
        {
          organization_id: primaryOrganizationId,
          fingerprint: `direct_write_${suffix}`,
          source: "server_action",
          route: "/dashboard",
        },
        ownerSession.accessToken,
      ),
    ).rejects.toThrow(/permission|42501|denied/i);

    await expect(
      rpc(
        "report_application_incident",
        {
          target_org_id: primaryOrganizationId,
          target_fingerprint: "cliente_carlos_telefone_31999999999",
          target_source: "dashboard_error",
          target_route: "/dashboard",
        },
        ownerSession.accessToken,
      ),
    ).rejects.toThrow(/Identificador de incidente inválido|22023|invalid/i);

    await primaryCard
      .getByLabel(`Observação para resolver ${primaryFingerprint}`)
      .fill("Corrigido e validado no Quality Gate 1.9F");
    await primaryCard.getByRole("button", { name: "Marcar como resolvido" }).click();
    await expect(primaryCard).toHaveCount(0);

    await page.goto("/dashboard/confiabilidade?status=resolved");
    const resolvedCard = page.getByTestId(`incident-${primaryIncidentId}`);
    await expect(resolvedCard.getByText("Resolvido", { exact: true })).toBeVisible();
    await expect(resolvedCard).toContainText("Corrigido e validado no Quality Gate 1.9F");

    const auditCount = runPostgres(`
      select count(*)
      from public.audit_logs
      where organization_id = ${uuid(primaryOrganizationId)}
        and action = 'reliability.incident_resolved'
        and entity_id = ${uuid(primaryIncidentId)};
    `);
    expect(auditCount).toBe("1");

    await page.goto("/rota-inexistente-autoqa-1-9f");
    await expect(page.getByRole("heading", { name: "Esta página não existe." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir o dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  test("gerente reporta falhas, mas não consulta, resolve ou contorna o limite", async ({ page }) => {
    await login(page, managerEmail);
    await expect(page.getByRole("link", { name: "Confiabilidade" })).toHaveCount(0);

    await page.goto("/dashboard/confiabilidade");
    await expect(page).toHaveURL(/\/dashboard\/sem-acesso\?permission=network\.view/);

    const managerSession = await signIn(managerEmail, password);
    await expect(
      rpc(
        "get_owned_application_incidents",
        {
          filter_organization_id: primaryOrganizationId,
          filter_status: "all",
          filter_query: null,
          result_limit: 100,
          result_offset: 0,
        },
        managerSession.accessToken,
      ),
    ).rejects.toThrow(/Somente um proprietário|42501|permission/i);

    await expect(
      rpc(
        "resolve_application_incident",
        {
          target_incident_id: branchIncidentId,
          target_resolution_note: "tentativa indevida",
        },
        managerSession.accessToken,
      ),
    ).rejects.toThrow(/Somente o proprietário|42501|permission/i);

    const visibleRows = await selectRows<IncidentRow[]>(
      "application_incidents",
      "select=id,organization_id,fingerprint",
      managerSession.accessToken,
    );
    expect(visibleRows).toEqual([]);

    const rateLimitRows = Array.from({ length: 19 }, () => `
      (${uuid(primaryOrganizationId)}, ${uuid(managerUserId)}, ${q(`server_${randomUUID().replaceAll("-", "")}`)}, 'server_action', '/dashboard/autoqa-limit')
    `).join(",");

    runPostgres(`
      insert into public.application_incidents (
        organization_id,
        reporter_user_id,
        fingerprint,
        source,
        route
      )
      values ${rateLimitRows};
    `);

    await expect(
      rpc(
        "report_application_incident",
        {
          target_org_id: primaryOrganizationId,
          target_fingerprint: `server_${randomUUID().replaceAll("-", "")}`,
          target_source: "server_action",
          target_route: "/dashboard/autoqa-limit",
        },
        managerSession.accessToken,
      ),
    ).rejects.toThrow(/Limite temporário|54000|limit/i);
  });

  test("proprietário externo permanece isolado em sua própria operação", async ({ page }) => {
    await login(page, externalOwnerEmail);
    await page.goto("/dashboard/confiabilidade");

    const incidentRegion = page.getByRole("region", {
      name: "Incidentes da aplicação",
    });
    await expect(incidentRegion.getByText(externalName, { exact: true }).first()).toBeVisible();
    await expect(incidentRegion.getByText(primaryName, { exact: true })).toHaveCount(0);
    await expect(incidentRegion.getByText(branchName, { exact: true })).toHaveCount(0);

    const externalSession = await signIn(externalOwnerEmail, password);
    const rows = await rpc<IncidentRow[]>(
      "get_owned_application_incidents",
      {
        filter_organization_id: null,
        filter_status: "all",
        filter_query: null,
        result_limit: 100,
        result_offset: 0,
      },
      externalSession.accessToken,
    );

    expect(new Set(rows.map((row) => row.organization_id))).toEqual(
      new Set([externalOrganizationId]),
    );
    expect(rows.some((row) => row.organization_id === primaryOrganizationId)).toBe(false);

    const visibleRows = await selectRows<{ organization_id: string }[]>(
      "application_incidents",
      "select=organization_id",
      externalSession.accessToken,
    );
    expect(new Set(visibleRows.map((row) => row.organization_id))).toEqual(
      new Set([externalOrganizationId]),
    );

    await expect(
      rpc(
        "report_application_incident",
        {
          target_org_id: primaryOrganizationId,
          target_fingerprint: `server_${randomUUID().replaceAll("-", "")}`,
          target_source: "server_action",
          target_route: "/dashboard",
        },
        externalSession.accessToken,
      ),
    ).rejects.toThrow(/não pertence|42501|permission/i);
  });
});
