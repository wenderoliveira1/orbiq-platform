import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import {
  autoQaEnv,
  loadState,
  runPostgres,
  signUp,
  sqlLiteral,
} from "./support/orbiq-api";

const EXPORT_BUCKET = "organization-data-exports";
const password = "OrbiqQA!2026";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

let latestExportRequestId = "";

function q(value: string) {
  return sqlLiteral(value);
}

async function login(page: Page, email: string, loginPassword: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(loginPassword);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function snapshotTextFromDocument(raw: string) {
  const marker = ',"snapshot":';
  const markerIndex = raw.indexOf(marker);

  if (markerIndex < 0 || !raw.endsWith("}\n")) {
    throw new Error("Formato da exportação AutoQA inesperado.");
  }

  return raw.slice(markerIndex + marker.length, -2);
}

test.describe("Fase 2.0I - entrega privada de exportações", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test("proprietário recebe o JSON pelo Storage privado e a cópia temporária é removida", async ({
    page,
  }) => {
    const state = await loadState();
    await login(page, state.email, state.password);
    await page.goto("/dashboard/dados");

    expect(
      runPostgres(`
        select public::text || '|' || file_size_limit::text
        from storage.buckets
        where id = ${q(EXPORT_BUCKET)};
      `),
    ).toBe("false|57671680");

    const policyCount = Number(
      runPostgres(`
        select count(*)
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname in (
            'orbiq_data_exports_insert_owner',
            'orbiq_data_exports_select_owner',
            'orbiq_data_exports_delete_owner'
          );
      `),
    );
    expect(policyCount).toBe(3);

    const routeResponses: string[] = [];
    const storageRequests: string[] = [];

    page.on("response", (response) => {
      if (/\/dashboard\/dados\/exportar\/[0-9a-f-]+$/.test(response.url())) {
        routeResponses.push(response.headers()["content-type"] ?? "");
      }
    });
    page.on("request", (request) => {
      if (request.url().includes("/storage/v1/")) {
        storageRequests.push(request.url());
      }
    });

    const operation = page.getByTestId(
      `data-operation-${state.organizationId}`,
    );
    const downloadPromise = page.waitForEvent("download");
    await operation.getByRole("button", { name: "Baixar exportação" }).click();

    await expect(page).toHaveURL(/\/dashboard\/dados\/exportar\/[0-9a-f-]+$/);
    await expect(
      page.getByRole("heading", { name: /Preparando dados de/i }),
    ).toBeVisible();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    expect(download.suggestedFilename()).toMatch(/^orbiq-.*\.json$/);

    await expect(
      page.getByRole("heading", {
        name: "Exportação concluída e cópia temporária removida.",
      }),
    ).toBeVisible();

    const raw = await readFile(downloadPath!, "utf8");
    const document = JSON.parse(raw) as {
      integrity: {
        byte_size: number;
        organization_id: string;
        schema_version: number;
        sha256: string;
      };
      snapshot: {
        format: string;
        organization: {
          id: string;
        };
      };
    };
    const snapshotText = snapshotTextFromDocument(raw);
    const checksum = createHash("sha256").update(snapshotText, "utf8").digest("hex");

    expect(document.integrity.organization_id).toBe(state.organizationId);
    expect(document.integrity.schema_version).toBe(1);
    expect(document.integrity.sha256).toBe(checksum);
    expect(document.integrity.byte_size).toBe(
      Buffer.byteLength(snapshotText, "utf8"),
    );
    expect(document.snapshot).toMatchObject({
      format: "orbiq-organization-data-export",
      organization: {
        id: state.organizationId,
      },
    });

    latestExportRequestId = runPostgres(`
      select id::text
      from public.organization_data_exports
      where organization_id = ${q(state.organizationId)}::uuid
        and requested_by = ${q(state.userId)}::uuid
        and downloaded_at is not null
      order by downloaded_at desc
      limit 1;
    `);

    expect(latestExportRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(routeResponses.some((contentType) => contentType.includes("text/html"))).toBe(
      true,
    );
    expect(routeResponses.some((contentType) => contentType.includes("application/json"))).toBe(
      false,
    );
    expect(
      storageRequests.some((url) =>
        url.includes(`/storage/v1/object/${EXPORT_BUCKET}/`),
      ),
    ).toBe(true);
    expect(
      storageRequests.some((url) => url.includes("/storage/v1/object/sign/")),
    ).toBe(true);

    const remainingObjects = Number(
      runPostgres(`
        select count(*)
        from storage.objects
        where bucket_id = ${q(EXPORT_BUCKET)}
          and name like ${q(`${state.userId}/${latestExportRequestId}/%`)};
      `),
    );
    expect(remainingObjects).toBe(0);
  });

  test("outra conta não consegue usar a janela privada do proprietário", async () => {
    const state = await loadState();
    const attacker = await signUp(
      `orbiq.export.attacker.${suffix}@example.com`,
      password,
    );
    const { url, publicKey } = autoQaEnv();
    const foreignPath = `${attacker.userId}/${latestExportRequestId}/orbiq-intrusion-20260827-130000.json`;

    const response = await fetch(
      `${url}/storage/v1/object/${EXPORT_BUCKET}/${foreignPath}`,
      {
        method: "POST",
        headers: {
          apikey: publicKey,
          Authorization: `Bearer ${attacker.accessToken}`,
          "Content-Type": "application/json",
          "x-upsert": "false",
        },
        body: JSON.stringify({ organization_id: state.organizationId }),
      },
    );

    expect(response.ok).toBe(false);
    expect([400, 401, 403]).toContain(response.status);

    const leakedObjects = Number(
      runPostgres(`
        select count(*)
        from storage.objects
        where bucket_id = ${q(EXPORT_BUCKET)}
          and name = ${q(foreignPath)};
      `),
    );
    expect(leakedObjects).toBe(0);
  });
});
