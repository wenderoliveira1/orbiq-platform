import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

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

type ExportRequestRow = {
  export_expires_at: string;
  export_request_id: string;
};

type ExportSnapshotRow = {
  export_byte_size: number;
  export_checksum: string;
  export_filename: string;
  export_organization_id: string;
  export_organization_name: string;
  export_schema_version: number;
  export_snapshot: string;
};

type OverviewRow = {
  data_records_total: number;
  organization_id: string;
  organization_name: string;
};

type ExportTableRow = {
  checksum_sha256: string | null;
  downloaded_at: string | null;
  id: string;
  organization_id: string;
};

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const password = "OrbiqQA!2026";

const ownerEmail = `orbiq.data.owner.${suffix}@example.com`;
const managerEmail = `orbiq.data.manager.${suffix}@example.com`;
const externalOwnerEmail = `orbiq.data.external.${suffix}@example.com`;

const primaryName = `AutoQA Dados Matriz ${suffix}`;
const branchName = `AutoQA Dados Filial ${suffix}`;
const externalName = `AutoQA Dados Externa ${suffix}`;

const primarySlug = `autoqa-dados-matriz-${suffix}`;
const branchSlug = `autoqa-dados-filial-${suffix}`;
const externalSlug = `autoqa-dados-externa-${suffix}`;

const primaryOrganizationId = randomUUID();
const branchOrganizationId = randomUUID();
const externalOrganizationId = randomUUID();
const primaryCustomerId = randomUUID();
const branchCustomerId = randomUUID();
const externalCustomerId = randomUUID();
const primaryVehicleId = randomUUID();
const primaryQuoteId = randomUUID();

const primaryCustomerName = `Cliente Matriz Dados ${suffix}`;
const branchCustomerName = `Cliente Filial Dados ${suffix}`;
const externalCustomerName = `Cliente Externo Sigiloso ${suffix}`;
const storedPrimaryCustomerName = primaryCustomerName.toUpperCase();
const storedBranchCustomerName = branchCustomerName.toUpperCase();
const storedExternalCustomerName = externalCustomerName.toUpperCase();
const inviteHash = `invite_hash_${randomUUID().replaceAll("-", "")}`;
const publicLinkToken = `public_token_${randomUUID().replaceAll("-", "")}`;

let ownerUserId = "";
let managerUserId = "";
let externalOwnerUserId = "";
let primaryExportRequestId = "";

function q(value: string) {
  return sqlLiteral(value);
}

function uuid(value: string) {
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

    insert into public.customers (id, organization_id, name, email)
    values
      (${uuid(primaryCustomerId)}, ${uuid(primaryOrganizationId)}, ${q(primaryCustomerName)}, 'matriz@example.com'),
      (${uuid(branchCustomerId)}, ${uuid(branchOrganizationId)}, ${q(branchCustomerName)}, 'filial@example.com'),
      (${uuid(externalCustomerId)}, ${uuid(externalOrganizationId)}, ${q(externalCustomerName)}, 'externo@example.com');

    insert into public.vehicles (
      id,
      organization_id,
      customer_id,
      plate,
      brand,
      model
    )
    values (
      ${uuid(primaryVehicleId)},
      ${uuid(primaryOrganizationId)},
      ${uuid(primaryCustomerId)},
      'DAT1G99',
      'Orbiq',
      'Continuity'
    );

    insert into public.quotes (
      id,
      organization_id,
      customer_id,
      vehicle_id,
      protocol,
      priority
    )
    values (
      ${uuid(primaryQuoteId)},
      ${uuid(primaryOrganizationId)},
      ${uuid(primaryCustomerId)},
      ${uuid(primaryVehicleId)},
      ${q(`QA-DATA-${suffix}`)},
      'normal'
    );

    insert into public.organization_invites (
      organization_id,
      email,
      role,
      token_hash,
      expires_at,
      invited_by
    )
    values (
      ${uuid(primaryOrganizationId)},
      'convidado@example.com',
      'viewer',
      ${q(inviteHash)},
      now() + interval '2 days',
      ${uuid(ownerUserId)}
    );

    insert into public.quote_public_links (
      organization_id,
      quote_id,
      token,
      expires_at,
      created_by
    )
    values (
      ${uuid(primaryOrganizationId)},
      ${uuid(primaryQuoteId)},
      ${q(publicLinkToken)},
      now() + interval '2 days',
      ${uuid(ownerUserId)}
    );

    commit;
  `);
}

test.describe("Fase 1.9G - dados, continuidade e LGPD", () => {
  test.describe.configure({ mode: "serial" });

  test("proprietário exporta a própria rede sem segredos e com uso único auditado", async ({ page }) => {
    const owner = await signUp(ownerEmail, password);
    const manager = await signUp(managerEmail, password);
    const externalOwner = await signUp(externalOwnerEmail, password);

    ownerUserId = owner.userId;
    managerUserId = manager.userId;
    externalOwnerUserId = externalOwner.userId;

    createFixture();
    await login(page, ownerEmail);
    await page.goto("/dashboard/dados");

    await expect(
      page.getByRole("heading", { name: "Centro de dados e continuidade" }),
    ).toBeVisible();

    const navigation = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    await expect(
      navigation.getByRole("link", { name: "Dados e privacidade" }),
    ).toHaveAttribute("aria-current", "page");

    const operations = page.getByRole("region", { name: "Dados por oficina" });
    await expect(operations.getByText(primaryName, { exact: true })).toBeVisible();
    await expect(operations.getByText(branchName, { exact: true })).toBeVisible();
    await expect(operations.getByText(externalName, { exact: true })).toHaveCount(0);

    const primaryCard = page.getByTestId(
      `data-operation-${primaryOrganizationId}`,
    );
    const downloadPromise = page.waitForEvent("download");
    await primaryCard.getByRole("button", { name: "Baixar exportação" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();

    expect(downloadPath).not.toBeNull();
    expect(download.suggestedFilename()).toMatch(/^orbiq-autoqa-dados-matriz-.*\.json$/);

    const rawExport = await readFile(downloadPath!, "utf8");
    const document = JSON.parse(rawExport) as {
      integrity: {
        byte_size: number;
        organization_id: string;
        schema_version: number;
        sha256: string;
      };
      snapshot: {
        data: Record<string, unknown> & {
          customers: Array<{ name: string; organization_id: string }>;
          organization_invites: Array<Record<string, unknown>>;
          quote_public_links: Array<Record<string, unknown>>;
        };
        format: string;
        organization: { id: string };
        schema_version: number;
      };
    };

    expect(document.integrity).toMatchObject({
      organization_id: primaryOrganizationId,
      schema_version: 1,
    });
    expect(document.integrity.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(document.integrity.byte_size).toBeGreaterThan(0);
    expect(document.snapshot).toMatchObject({
      format: "orbiq-organization-data-export",
      organization: { id: primaryOrganizationId },
      schema_version: 1,
    });
    expect(document.snapshot.data.customers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: storedPrimaryCustomerName,
          organization_id: primaryOrganizationId,
        }),
      ]),
    );
    expect(document.snapshot.data.organization_invites[0]).not.toHaveProperty(
      "token_hash",
    );
    expect(document.snapshot.data.quote_public_links[0]).not.toHaveProperty(
      "token",
    );
    expect(rawExport).not.toContain(inviteHash);
    expect(rawExport).not.toContain(publicLinkToken);
    expect(rawExport).not.toContain(storedBranchCustomerName);
    expect(rawExport).not.toContain(storedExternalCustomerName);

    const exportRows = runPostgres(`
      select
        id::text || '|' || checksum_sha256 || '|' || byte_size::text
      from public.organization_data_exports
      where
        organization_id = ${uuid(primaryOrganizationId)}
        and requested_by = ${uuid(ownerUserId)}
      order by created_at desc
      limit 1;
    `).split("|");

    primaryExportRequestId = exportRows[0];
    expect(exportRows[1]).toBe(document.integrity.sha256);
    expect(Number(exportRows[2])).toBe(document.integrity.byte_size);

    const auditCount = runPostgres(`
      select count(*)
      from public.audit_logs
      where
        organization_id = ${uuid(primaryOrganizationId)}
        and entity_id = ${uuid(primaryExportRequestId)}
        and action in (
          'organization.data_export_requested',
          'organization.data_export_downloaded'
        );
    `);
    expect(auditCount).toBe("2");

    await page.goto(`/dashboard/dados/exportar/${primaryExportRequestId}`);
    await expect(page).toHaveURL(/\/dashboard\/dados\?erro=/);
    const exportError = page
      .getByRole("alert")
      .filter({ hasText: "Exportação não concluída" });
    await expect(exportError).toContainText(
      "expirou ou já foi utilizada",
    );

    runPostgres(`
      insert into public.organization_data_exports (
        organization_id,
        requested_by,
        downloaded_at,
        checksum_sha256,
        byte_size
      )
      values
        (${uuid(primaryOrganizationId)}, ${uuid(ownerUserId)}, now(), repeat('a', 64), 10),
        (${uuid(branchOrganizationId)}, ${uuid(ownerUserId)}, now(), repeat('b', 64), 10);
    `);

    const ownerSession = await signIn(ownerEmail, password);
    await expect(
      rpc(
        "create_organization_data_export",
        { target_org_id: primaryOrganizationId },
        ownerSession.accessToken,
      ),
    ).rejects.toThrow(/Limite temporário|54000|limit/i);
  });

  test("gerente não vê, não solicita e não grava exportações diretamente", async ({ page }) => {
    await login(page, managerEmail);
    await expect(
      page.getByRole("link", { name: "Dados e privacidade" }),
    ).toHaveCount(0);

    await page.goto("/dashboard/dados");
    await expect(page).toHaveURL(
      /\/dashboard\/sem-acesso\?permission=data\.export/,
    );

    const managerSession = await signIn(managerEmail, password);
    const permissions = await rpc<string[]>(
      "orbiq_list_my_permissions",
      { target_org_id: primaryOrganizationId },
      managerSession.accessToken,
    );
    expect(permissions).not.toContain("data.export");

    await expect(
      rpc(
        "get_owned_data_governance_overview",
        {},
        managerSession.accessToken,
      ),
    ).rejects.toThrow(/Somente um proprietário|42501|permission/i);

    await expect(
      rpc(
        "create_organization_data_export",
        { target_org_id: primaryOrganizationId },
        managerSession.accessToken,
      ),
    ).rejects.toThrow(/não pertence ao proprietário|42501|permission/i);

    await expect(
      rpc(
        "consume_organization_data_export",
        { target_request_id: primaryExportRequestId },
        managerSession.accessToken,
      ),
    ).rejects.toThrow(/Exportação indisponível|42501|permission/i);

    const visibleRows = await selectRows<ExportTableRow[]>(
      "organization_data_exports",
      "select=id,organization_id,downloaded_at,checksum_sha256",
      managerSession.accessToken,
    );
    expect(visibleRows).toEqual([]);

    await expect(
      insertRows(
        "organization_data_exports",
        {
          organization_id: primaryOrganizationId,
          requested_by: managerUserId,
        },
        managerSession.accessToken,
      ),
    ).rejects.toThrow(/permission|42501|denied/i);
  });

  test("proprietário externo permanece isolado em inventário, RLS e snapshot", async ({ page }) => {
    await login(page, externalOwnerEmail);
    await page.goto("/dashboard/dados");

    const operations = page.getByRole("region", { name: "Dados por oficina" });
    await expect(operations.getByText(externalName, { exact: true })).toBeVisible();
    await expect(operations.getByText(primaryName, { exact: true })).toHaveCount(0);
    await expect(operations.getByText(branchName, { exact: true })).toHaveCount(0);

    const externalSession = await signIn(externalOwnerEmail, password);
    const overview = await rpc<OverviewRow[]>(
      "get_owned_data_governance_overview",
      {},
      externalSession.accessToken,
    );
    expect(overview.map((row) => row.organization_id)).toEqual([
      externalOrganizationId,
    ]);

    await expect(
      rpc(
        "create_organization_data_export",
        { target_org_id: primaryOrganizationId },
        externalSession.accessToken,
      ),
    ).rejects.toThrow(/não pertence ao proprietário|42501|permission/i);

    const request = await rpc<ExportRequestRow[]>(
      "create_organization_data_export",
      { target_org_id: externalOrganizationId },
      externalSession.accessToken,
    );
    const snapshot = await rpc<ExportSnapshotRow[]>(
      "consume_organization_data_export",
      { target_request_id: request[0].export_request_id },
      externalSession.accessToken,
    );

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].export_organization_id).toBe(externalOrganizationId);
    expect(snapshot[0].export_snapshot).toContain(storedExternalCustomerName);
    expect(snapshot[0].export_snapshot).not.toContain(storedPrimaryCustomerName);
    expect(snapshot[0].export_snapshot).not.toContain(storedBranchCustomerName);
    expect(snapshot[0].export_snapshot).not.toContain(inviteHash);
    expect(snapshot[0].export_snapshot).not.toContain(publicLinkToken);

    const visibleRows = await selectRows<ExportTableRow[]>(
      "organization_data_exports",
      "select=id,organization_id,downloaded_at,checksum_sha256",
      externalSession.accessToken,
    );
    expect(new Set(visibleRows.map((row) => row.organization_id))).toEqual(
      new Set([externalOrganizationId]),
    );
  });
});
