import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { autoQaEnv, loadState, runPostgres } from "./support/orbiq-api";

const requiredMigrations = [
  "20260826090000_owned_organization_overview.sql",
  "20260826120000_network_governance.sql",
  "20260826170000_application_reliability.sql",
  "20260826200000_data_continuity.sql",
  "20260827133500_private_export_delivery.sql",
  "20260829105000_quote_write_bounds.sql",
] as const;

const recoveredRpcs = [
  {
    body: { report_month: null },
    name: "get_owned_organization_overview",
  },
  {
    body: {},
    name: "get_owned_network_activity",
  },
  {
    body: {},
    name: "get_owned_application_incidents",
  },
] as const;

const recoveredScreens = [
  {
    heading: "Visão consolidada da rede",
    path: "/dashboard/rede",
  },
  {
    heading: "Auditoria consolidada da rede",
    path: "/dashboard/rede/atividade",
  },
  {
    heading: "Central de incidentes",
    path: "/dashboard/confiabilidade",
  },
] as const;

async function login(page: Page) {
  const state = await loadState();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(state.email);
  await page.getByLabel("Senha").fill(state.password);
  await page.getByRole("button", { name: "Entrar no Orbiq" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);
}

function prepareLocalSchema() {
  const result = spawnSync(
    process.execPath,
    ["scripts/dev-start.mjs", "--prepare-only"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    },
  );

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");

  if (result.error) {
    throw new Error(`Falha ao executar prepare:local: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`prepare:local retornou ${result.status}.\n${output}`);
  }

  return output;
}

async function expectRpcPublished(
  name: string,
  body: Record<string, unknown>,
) {
  const { url, publicKey } = autoQaEnv();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${publicKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const responseBody = await response.text();
  const missing =
    response.status === 404 &&
    /PGRST202|schema cache|Could not find the function/i.test(responseBody);

  expect(
    missing,
    `${name} não foi publicada: HTTP ${response.status} ${responseBody}`,
  ).toBe(false);
}

test.describe("Fase 2.0Y - recuperação segura do schema local", () => {
  test.describe.configure({ mode: "serial" });

  test("mantém o registro ordenado e o comando de reparo sem servidor", async () => {
    const [source, packageSource] = await Promise.all([
      readFile("scripts/dev-start.mjs", "utf8"),
      readFile("package.json", "utf8"),
    ]);
    const packageJson = JSON.parse(packageSource) as {
      scripts?: Record<string, string>;
    };

    let previousIndex = -1;
    for (const migration of requiredMigrations) {
      const index = source.indexOf(migration);
      expect(index, `${migration} não foi registrada`).toBeGreaterThan(
        previousIndex,
      );
      previousIndex = index;
    }

    expect(packageJson.scripts?.["prepare:local"]).toBe(
      "node scripts/dev-start.mjs --prepare-only",
    );
    expect(source).toContain("begin;\\n${migration.trim()}\\ncommit;");
  });

  test("recria RPCs ausentes e confirma a publicação no PostgREST", async () => {
    runPostgres(`
      begin;

      drop function if exists
        public.get_owned_organization_overview(date);

      drop function if exists
        public.get_owned_network_activity(
          uuid,
          text,
          timestamptz,
          timestamptz,
          text,
          integer,
          integer
        );

      drop function if exists
        public.get_owned_application_incidents(
          uuid,
          text,
          text,
          integer,
          integer
        );

      commit;
    `);

    const output = prepareLocalSchema();

    expect(output).toContain("Fase 1.9D reconciliada");
    expect(output).toContain("Fase 1.9E reconciliada");
    expect(output).toContain("Fase 1.9F reconciliada");
    expect(output).toContain("4 RPCs obrigatórias publicadas no PostgREST");
    expect(output).toContain("ORBIQ LOCAL PREPARADO");
    expect(output).not.toContain(" ORBIQ WEB\n");

    const databaseState = runPostgres(`
      select case
        when
          to_regprocedure(
            'public.get_owned_organization_overview(date)'
          ) is not null
          and to_regprocedure(
            'public.get_owned_network_activity(uuid,text,timestamptz,timestamptz,text,integer,integer)'
          ) is not null
          and to_regprocedure(
            'public.get_owned_application_incidents(uuid,text,text,integer,integer)'
          ) is not null
        then 'ready'
        else 'missing'
      end;
    `);

    expect(databaseState).toBe("ready");

    for (const rpc of recoveredRpcs) {
      await expectRpcPublished(rpc.name, rpc.body);
    }
  });

  test("abre as três telas recuperadas sem erro da aplicação", async ({ page }) => {
    const runtimeErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        runtimeErrors.push(`console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      runtimeErrors.push(`pageerror: ${error.message}`);
    });

    await login(page);

    for (const screen of recoveredScreens) {
      await page.goto(screen.path);
      await expect(
        page.getByRole("heading", { name: screen.heading, level: 1 }),
      ).toBeVisible();
    }

    expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
  });
});
