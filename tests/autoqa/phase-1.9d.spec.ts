import {
  randomUUID,
} from "node:crypto";

import {
  expect,
  test,
  type Page,
} from "@playwright/test";

import {
  rpc,
  runPostgres,
  signIn,
  signUp,
  sqlLiteral,
} from "./support/orbiq-api";


type NetworkOverviewRow = {
  active_members:
    number;

  approved_amount_month:
    number;

  approved_quotes_month:
    number;

  organization_id:
    string;

  organization_name:
    string;

  quotes_month:
    number;

  rejected_quotes_month:
    number;

  waiting_quotes_month:
    number;
};


const suffix =
  Date.now() +
  "-" +
  Math.floor(
    Math.random() *
    100000,
  );


const password =
  "OrbiqQA!2026";


const ownerEmail =
  "orbiq.network.owner." +
  suffix +
  "@example.com";


const managerEmail =
  "orbiq.network.manager." +
  suffix +
  "@example.com";


const externalOwnerEmail =
  "orbiq.network.external." +
  suffix +
  "@example.com";


const primaryName =
  "AutoQA Rede Matriz " +
  suffix;


const branchName =
  "AutoQA Rede Filial " +
  suffix;


const externalName =
  "AutoQA Rede Externa " +
  suffix;


const primarySlug =
  "autoqa-rede-matriz-" +
  suffix;


const branchSlug =
  "autoqa-rede-filial-" +
  suffix;


const externalSlug =
  "autoqa-rede-externa-" +
  suffix;


const primaryOrganizationId =
  randomUUID();


const branchOrganizationId =
  randomUUID();


const externalOrganizationId =
  randomUUID();


const primaryCustomerId =
  randomUUID();


const branchCustomerId =
  randomUUID();


const externalCustomerId =
  randomUUID();


const primaryVehicleId =
  randomUUID();


const branchVehicleId =
  randomUUID();


const externalVehicleId =
  randomUUID();


let ownerUserId =
  "";


let managerUserId =
  "";


let externalOwnerUserId =
  "";


function q(
  value:
    string,
): string {

  return sqlLiteral(
    value,
  );
}


function uuid(
  value:
    string,
): string {

  return q(
    value,
  ) +
  "::uuid";
}


async function login(
  page:
    Page,

  email:
    string,
) {

  await page.goto(
    "/login",
  );


  await page
    .getByLabel(
      "E-mail",
    )
    .fill(
      email,
    );


  await page
    .getByLabel(
      "Senha",
    )
    .fill(
      password,
    );


  await page
    .getByRole(
      "button",
      {
        name:
          "Entrar no Orbiq",
      },
    )
    .click();


  await expect(
    page,
  ).toHaveURL(
    /\/dashboard/,
  );
}


function createFixture() {

  runPostgres(
    `
      begin;

      delete from public.organizations
      where slug in (
        ${q(primarySlug)},
        ${q(branchSlug)},
        ${q(externalSlug)}
      );

      insert into public.organizations (
        id,
        name,
        slug
      )
      values
        (
          ${uuid(primaryOrganizationId)},
          ${q(primaryName)},
          ${q(primarySlug)}
        ),
        (
          ${uuid(branchOrganizationId)},
          ${q(branchName)},
          ${q(branchSlug)}
        ),
        (
          ${uuid(externalOrganizationId)},
          ${q(externalName)},
          ${q(externalSlug)}
        );

      insert into public.organization_members (
        organization_id,
        user_id,
        role,
        status,
        created_at
      )
      values
        (
          ${uuid(primaryOrganizationId)},
          ${uuid(ownerUserId)},
          'owner',
          'active',
          now() - interval '2 minutes'
        ),
        (
          ${uuid(branchOrganizationId)},
          ${uuid(ownerUserId)},
          'owner',
          'active',
          now() - interval '1 minute'
        ),
        (
          ${uuid(primaryOrganizationId)},
          ${uuid(managerUserId)},
          'manager',
          'active',
          now()
        ),
        (
          ${uuid(externalOrganizationId)},
          ${uuid(externalOwnerUserId)},
          'owner',
          'active',
          now()
        );

      insert into public.organization_settings (
        organization_id,
        legal_name,
        phone,
        email,
        city,
        state
      )
      values
        (
          ${uuid(primaryOrganizationId)},
          ${q(primaryName + " Ltda")},
          '(31) 3333-1901',
          ${q(ownerEmail)},
          'Belo Horizonte',
          'MG'
        ),
        (
          ${uuid(branchOrganizationId)},
          ${q(branchName + " Ltda")},
          '(31) 3333-1902',
          ${q(ownerEmail)},
          'Contagem',
          'MG'
        ),
        (
          ${uuid(externalOrganizationId)},
          ${q(externalName + " Ltda")},
          '(31) 3333-1903',
          ${q(externalOwnerEmail)},
          'Betim',
          'MG'
        );

      insert into public.customers (
        id,
        organization_id,
        name,
        phone,
        created_by
      )
      values
        (
          ${uuid(primaryCustomerId)},
          ${uuid(primaryOrganizationId)},
          'Cliente Rede Matriz',
          '(31) 99999-1901',
          ${uuid(ownerUserId)}
        ),
        (
          ${uuid(branchCustomerId)},
          ${uuid(branchOrganizationId)},
          'Cliente Rede Filial',
          '(31) 99999-1902',
          ${uuid(ownerUserId)}
        ),
        (
          ${uuid(externalCustomerId)},
          ${uuid(externalOrganizationId)},
          'Cliente Rede Externa',
          '(31) 99999-1903',
          ${uuid(externalOwnerUserId)}
        );

      insert into public.vehicles (
        id,
        organization_id,
        customer_id,
        plate,
        brand,
        model
      )
      values
        (
          ${uuid(primaryVehicleId)},
          ${uuid(primaryOrganizationId)},
          ${uuid(primaryCustomerId)},
          'NET1A01',
          'Orbiq',
          'Matriz'
        ),
        (
          ${uuid(branchVehicleId)},
          ${uuid(branchOrganizationId)},
          ${uuid(branchCustomerId)},
          'NET1A02',
          'Orbiq',
          'Filial'
        ),
        (
          ${uuid(externalVehicleId)},
          ${uuid(externalOrganizationId)},
          ${uuid(externalCustomerId)},
          'NET1A03',
          'Orbiq',
          'Externa'
        );

      insert into public.quotes (
        organization_id,
        customer_id,
        vehicle_id,
        protocol,
        priority,
        status,
        commercial_status,
        final_amount,
        created_by
      )
      values
        (
          ${uuid(primaryOrganizationId)},
          ${uuid(primaryCustomerId)},
          ${uuid(primaryVehicleId)},
          ${q("NET-M-A-" + suffix)},
          'normal',
          'approved',
          'approved',
          1200,
          ${uuid(ownerUserId)}
        ),
        (
          ${uuid(primaryOrganizationId)},
          ${uuid(primaryCustomerId)},
          ${uuid(primaryVehicleId)},
          ${q("NET-M-R-" + suffix)},
          'normal',
          'rejected',
          'rejected',
          900,
          ${uuid(ownerUserId)}
        ),
        (
          ${uuid(primaryOrganizationId)},
          ${uuid(primaryCustomerId)},
          ${uuid(primaryVehicleId)},
          ${q("NET-M-W-" + suffix)},
          'normal',
          'estimating',
          'ready',
          700,
          ${uuid(ownerUserId)}
        ),
        (
          ${uuid(branchOrganizationId)},
          ${uuid(branchCustomerId)},
          ${uuid(branchVehicleId)},
          ${q("NET-F-A1-" + suffix)},
          'normal',
          'approved',
          'approved',
          2500,
          ${uuid(ownerUserId)}
        ),
        (
          ${uuid(branchOrganizationId)},
          ${uuid(branchCustomerId)},
          ${uuid(branchVehicleId)},
          ${q("NET-F-A2-" + suffix)},
          'normal',
          'approved',
          'approved',
          1500,
          ${uuid(ownerUserId)}
        ),
        (
          ${uuid(externalOrganizationId)},
          ${uuid(externalCustomerId)},
          ${uuid(externalVehicleId)},
          ${q("NET-X-A-" + suffix)},
          'normal',
          'approved',
          'approved',
          99000,
          ${uuid(externalOwnerUserId)}
        );

      commit;
    `,
  );
}


test.describe(
  "Fase 1.9D - visão consolidada da rede",
  () => {

    test.describe.configure(
      {
        mode:
          "serial",
      },
    );


    test(
      "proprietário compara apenas suas operações e ativa a filial",
      async ({
        page,
      }) => {

        const owner =
          await signUp(
            ownerEmail,
            password,
          );


        const manager =
          await signUp(
            managerEmail,
            password,
          );


        const externalOwner =
          await signUp(
            externalOwnerEmail,
            password,
          );


        ownerUserId =
          owner.userId;


        managerUserId =
          manager.userId;


        externalOwnerUserId =
          externalOwner.userId;


        createFixture();


        await login(
          page,
          ownerEmail,
        );


        await page.goto(
          "/dashboard/rede",
        );


        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Visão consolidada da rede",
            },
          ),
        ).toBeVisible();


        await expect(
          page.getByRole(
            "link",
            {
              name:
                "Visão da rede",
            },
          ),
        ).toHaveAttribute(
          "aria-current",
          "page",
        );


        const summary =
          page.getByRole(
            "region",
            {
              name:
                "Resumo consolidado",
            },
          );


        await expect(
          summary,
        ).toContainText(
          "2",
        );


        await expect(
          summary,
        ).toContainText(
          "5",
        );


        await expect(
          summary,
        ).toContainText(
          "75,0%",
        );


        await expect(
          summary,
        ).toContainText(
          /5\.200,00/,
        );


        const primaryCard =
          page.getByTestId(
            "network-card-" +
            primaryOrganizationId,
          );


        const branchCard =
          page.getByTestId(
            "network-card-" +
            branchOrganizationId,
          );


        await expect(
          primaryCard,
        ).toContainText(
          primaryName,
        );


        await expect(
          primaryCard,
        ).toContainText(
          /1\.200,00/,
        );


        await expect(
          branchCard,
        ).toContainText(
          branchName,
        );


        await expect(
          branchCard,
        ).toContainText(
          /4\.000,00/,
        );


        await expect(
          page.getByText(
            externalName,
            {
              exact:
                true,
            },
          ),
        ).toHaveCount(
          0,
        );


        const session =
          await signIn(
            ownerEmail,
            password,
          );


        const overview =
          await rpc<
            NetworkOverviewRow[]
          >(
            "get_owned_organization_overview",
            {
              report_month:
                new Date()
                  .toISOString()
                  .slice(
                    0,
                    7,
                  ) +
                "-01",
            },
            session.accessToken,
          );


        expect(
          overview,
        ).toHaveLength(
          2,
        );


        const byOrganization =
          new Map(
            overview.map(
              (
                row,
              ) =>
                [
                  row.organization_id,
                  row,
                ] as const,
            ),
          );


        expect(
          Number(
            byOrganization.get(
              primaryOrganizationId,
            )?.approved_amount_month,
          ),
        ).toBe(
          1200,
        );


        expect(
          Number(
            byOrganization.get(
              branchOrganizationId,
            )?.approved_amount_month,
          ),
        ).toBe(
          4000,
        );


        expect(
          byOrganization.has(
            externalOrganizationId,
          ),
        ).toBe(
          false,
        );


        await page
          .getByRole(
            "button",
            {
              name:
                "Abrir operação " +
                branchName,
            },
          )
          .click();


        await expect(
          page,
        ).toHaveURL(
          /\/dashboard\?organization_switched=1$/,
        );


        await expect(
          page.getByLabel(
            "Oficina ativa",
            {
              exact:
                true,
            },
          ),
        ).toHaveValue(
          branchOrganizationId,
        );


        await page.goto(
          "/dashboard/rede",
        );


        await expect(
          page.getByRole(
            "button",
            {
              name:
                branchName +
                " é a oficina ativa",
            },
          ),
        ).toBeVisible();
      },
    );


    test(
      "gerente não acessa a rota nem força a RPC consolidada",
      async ({
        page,
      }) => {

        await login(
          page,
          managerEmail,
        );


        await page.goto(
          "/dashboard/rede",
        );


        await expect(
          page,
        ).toHaveURL(
          /\/dashboard\/sem-acesso\?permission=network\.view/,
        );


        await expect(
          page.getByRole(
            "link",
            {
              name:
                "Visão da rede",
            },
          ),
        ).toHaveCount(
          0,
        );


        const session =
          await signIn(
            managerEmail,
            password,
          );


        await expect(
          rpc(
            "get_owned_organization_overview",
            {
              report_month:
                new Date()
                  .toISOString()
                  .slice(
                    0,
                    7,
                  ) +
                "-01",
            },
            session.accessToken,
          ),
        ).rejects.toThrow(
          /Somente um proprietário|42501|permission/i,
        );
      },
    );


    test(
      "proprietário externo enxerga somente a própria oficina",
      async ({
        page,
      }) => {

        await login(
          page,
          externalOwnerEmail,
        );


        await page.goto(
          "/dashboard/rede",
        );


        await expect(
          page.getByText(
            externalName,
            {
              exact:
                true,
            },
          ),
        ).toBeVisible();


        await expect(
          page.getByText(
            primaryName,
            {
              exact:
                true,
            },
          ),
        ).toHaveCount(
          0,
        );


        await expect(
          page.getByText(
            branchName,
            {
              exact:
                true,
            },
          ),
        ).toHaveCount(
          0,
        );


        const session =
          await signIn(
            externalOwnerEmail,
            password,
          );


        const overview =
          await rpc<
            NetworkOverviewRow[]
          >(
            "get_owned_organization_overview",
            {
              report_month:
                new Date()
                  .toISOString()
                  .slice(
                    0,
                    7,
                  ) +
                "-01",
            },
            session.accessToken,
          );


        expect(
          overview.map(
            (
              row,
            ) =>
              row.organization_id,
          ),
        ).toEqual(
          [
            externalOrganizationId,
          ],
        );
      },
    );
  },
);
