import Link from "next/link";

import {
  requireCurrentPermission,
} from "../_lib/permissions";

import {
  OpenOrganizationButton,
} from "./open-organization-button";

import styles from "./network-overview.module.css";


type NetworkOverviewRow = {
  active_members:
    number;

  active_work_orders:
    number;

  approved_amount_month:
    number;

  approved_quotes_month:
    number;

  customers_total:
    number;

  last_quote_at:
    string |
    null;

  open_purchase_orders:
    number;

  organization_id:
    string;

  organization_name:
    string;

  organization_slug:
    string;

  quotes_month:
    number;

  rejected_quotes_month:
    number;

  vehicles_total:
    number;

  waiting_quotes_month:
    number;
};


function number(
  value:
    number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
  ).format(
    value,
  );
}


function money(
  value:
    number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",

      maximumFractionDigits:
        2,
    },
  ).format(
    value,
  );
}


function percentage(
  approved:
    number,

  rejected:
    number,
): string {

  const decisions =
    approved +
    rejected;


  const value =
    decisions >
    0
      ? (
          approved /
          decisions
        ) *
        100
      : 0;


  return new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits:
        1,

      maximumFractionDigits:
        1,
    },
  ).format(
    value,
  ) + "%";
}


function dateTime(
  value:
    string |
    null,
): string {

  if (
    !value
  ) {

    return "Nenhum orçamento registrado";
  }


  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle:
        "short",

      timeStyle:
        "short",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


export default async function NetworkOverviewPage() {

  const {
    supabase,
    organization,
  } =
    await requireCurrentPermission(
      "network.view",
    );


  const now =
    new Date();


  const reportMonth =
    [
      now.getUTCFullYear(),
      String(
        now.getUTCMonth() +
        1,
      ).padStart(
        2,
        "0",
      ),
      "01",
    ].join(
      "-",
    );


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_owned_organization_overview",
      {
        report_month:
          reportMonth,
      },
    );


  if (
    error
  ) {

    throw new Error(
      "Falha ao carregar a visão consolidada: " +
        error.message,
    );
  }


  const rows =
    (
      data ??
      []
    ) as NetworkOverviewRow[];


  const quotesTotal =
    rows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.quotes_month ??
          0,
        ),
      0,
    );


  const approvedTotal =
    rows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.approved_quotes_month ??
          0,
        ),
      0,
    );


  const rejectedTotal =
    rows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.rejected_quotes_month ??
          0,
        ),
      0,
    );


  const approvedAmount =
    rows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.approved_amount_month ??
          0,
        ),
      0,
    );


  const activeWorkOrders =
    rows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.active_work_orders ??
          0,
        ),
      0,
    );


  const monthLabel =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        month:
          "long",

        year:
          "numeric",
      },
    ).format(
      now,
    );


  return (
    <div className={styles.page}>

      <section className={styles.hero}>

        <div className={styles.heroMain}>

          <span className="orbiq-eyebrow">
            MULTIEMPRESA
          </span>

          <h1>
            Visão consolidada da rede
          </h1>

          <p>
            Compare suas oficinas em um único painel. Os números são agregados com segurança e cada operação continua isolada por organização.
          </p>

        </div>


        <div className={styles.heroAside}>

          <span className={styles.period}>
            {monthLabel}
          </span>


          <Link
            href="/dashboard/oficinas"
            className="orbiq-secondary-button"
          >
            Gerenciar oficinas
          </Link>

        </div>

      </section>


      <section
        className={styles.summaryGrid}
        aria-label="Resumo consolidado"
      >

        <article className={styles.summaryCard}>

          <span>
            Operações próprias
          </span>

          <strong>
            {number(
              rows.length,
            )}
          </strong>

          <small>
            oficinas em que você é proprietário
          </small>

        </article>


        <article className={styles.summaryCard}>

          <span>
            Orçamentos no mês
          </span>

          <strong>
            {number(
              quotesTotal,
            )}
          </strong>

          <small>
            somatório de todas as operações
          </small>

        </article>


        <article className={styles.summaryCard}>

          <span>
            Aprovação consolidada
          </span>

          <strong>
            {percentage(
              approvedTotal,
              rejectedTotal,
            )}
          </strong>

          <small>
            {number(
              approvedTotal,
            )} aprovados · {number(
              rejectedTotal,
            )} reprovados
          </small>

        </article>


        <article
          className={
            [
              styles.summaryCard,
              styles.summaryHighlight,
            ].join(
              " ",
            )
          }
        >

          <span>
            Valor aprovado
          </span>

          <strong>
            {money(
              approvedAmount,
            )}
          </strong>

          <small>
            {number(
              activeWorkOrders,
            )} ordem(ns) de serviço ativa(s)
          </small>

        </article>

      </section>


      <section className={styles.networkHeading}>

        <div>

          <span className="orbiq-eyebrow">
            OPERAÇÕES
          </span>

          <h2>
            Desempenho por oficina
          </h2>

        </div>


        <p>
          Dados do mês atual · atualização em tempo real
        </p>

      </section>


      <section
        className={styles.grid}
        aria-label="Oficinas da rede"
      >

        {rows.map(
          (
            row,
          ) => {

            const active =
              row.organization_id ===
              organization.id;


            return (
              <article
                key={
                  row.organization_id
                }
                data-testid={
                  "network-card-" +
                  row.organization_id
                }
                aria-label={
                  "Resumo da operação " +
                  row.organization_name
                }
                className={
                  [
                    styles.card,
                    active
                      ? styles.cardActive
                      : "",
                  ]
                    .filter(Boolean)
                    .join(
                      " ",
                    )
                }
              >

                <div className={styles.cardHeader}>

                  <div className={styles.cardTitle}>

                    <h3>
                      {row.organization_name}
                    </h3>

                    <span>
                      {row.organization_slug}
                    </span>

                  </div>


                  {active ? (

                    <span className={styles.activeBadge}>
                      Oficina ativa
                    </span>

                  ) : null}

                </div>


                <div className={styles.metrics}>

                  <div className={styles.metric}>

                    <span>
                      Orçamentos
                    </span>

                    <strong>
                      {number(
                        Number(
                          row.quotes_month,
                        ),
                      )}
                    </strong>

                  </div>


                  <div className={styles.metric}>

                    <span>
                      Valor aprovado
                    </span>

                    <strong>
                      {money(
                        Number(
                          row.approved_amount_month,
                        ),
                      )}
                    </strong>

                  </div>


                  <div className={styles.metric}>

                    <span>
                      Aprovação
                    </span>

                    <strong>
                      {percentage(
                        Number(
                          row.approved_quotes_month,
                        ),
                        Number(
                          row.rejected_quotes_month,
                        ),
                      )}
                    </strong>

                  </div>


                  <div className={styles.metric}>

                    <span>
                      OS ativas
                    </span>

                    <strong>
                      {number(
                        Number(
                          row.active_work_orders,
                        ),
                      )}
                    </strong>

                  </div>

                </div>


                <div className={styles.details}>

                  <div className={styles.detail}>

                    <span>
                      Clientes
                    </span>

                    <strong>
                      {number(
                        Number(
                          row.customers_total,
                        ),
                      )}
                    </strong>

                  </div>


                  <div className={styles.detail}>

                    <span>
                      Veículos
                    </span>

                    <strong>
                      {number(
                        Number(
                          row.vehicles_total,
                        ),
                      )}
                    </strong>

                  </div>


                  <div className={styles.detail}>

                    <span>
                      Equipe ativa
                    </span>

                    <strong>
                      {number(
                        Number(
                          row.active_members,
                        ),
                      )}
                    </strong>

                  </div>


                  <div className={styles.detail}>

                    <span>
                      Compras abertas
                    </span>

                    <strong>
                      {number(
                        Number(
                          row.open_purchase_orders,
                        ),
                      )}
                    </strong>

                  </div>

                </div>


                <div className={styles.cardFooter}>

                  <div className={styles.lastActivity}>

                    <span>
                      Último orçamento
                    </span>

                    <strong>
                      {dateTime(
                        row.last_quote_at,
                      )}
                    </strong>

                  </div>


                  <OpenOrganizationButton
                    active={
                      active
                    }
                    organizationId={
                      row.organization_id
                    }
                    organizationName={
                      row.organization_name
                    }
                  />

                </div>

              </article>
            );
          },
        )}

      </section>

    </div>
  );
}
