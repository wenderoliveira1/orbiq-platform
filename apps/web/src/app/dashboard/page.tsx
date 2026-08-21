import Link from "next/link";

import {
  getCurrentContext,
} from "./_lib/current-organization";

import {
  statusLabel,
} from "./orcamentos/quote-meta";


function count(
  value:
    number |
    null,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
  ).format(
    value ??
    0,
  );
}


function money(
  value:
    number |
    null,
): string {

  if (
    value ===
    null
  ) {

    return "—";
  }


  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    },
  ).format(
    value,
  );
}


function dateTime(
  value:
    string,
): string {

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


function priorityLabel(
  value:
    string,
): string {

  const labels:
    Record<string, string> = {

    normal:
      "Normal",

    customer_waiting:
      "Cliente aguardando",

    vehicle_stopped:
      "Veículo parado",
  };


  return (
    labels[
      value
    ] ??
    value
  );
}


function commercialLabel(
  value:
    string,
): string {

  const labels:
    Record<string, string> = {

    draft:
      "Comercial pendente",

    ready:
      "Aguardando cliente",

    approved:
      "Cliente aprovou",

    rejected:
      "Cliente reprovou",
  };


  return (
    labels[
      value
    ] ??
    value
  );
}


const activeQuoteStatuses = [
  "awaiting_evaluation",
  "awaiting_quote",
  "estimating",
  "approved",
  "awaiting_parts",
  "in_progress",
];


export default async function DashboardPage() {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const [
    awaitingQuoteResult,
    awaitingCustomerResult,
    awaitingPartsResult,
    inProgressResult,
    completedResult,
    vehicleStoppedResult,
    customerWaitingResult,
    purchasesOpenResult,
    workOrdersActiveResult,
    recentQuotesResult,
    customersResult,
    vehiclesResult,
  ] =
    await Promise.all([

      supabase
        .from("quotes")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "status",
          "awaiting_quote",
        ),

      supabase
        .from("quotes")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "commercial_status",
          "ready",
        ),

      supabase
        .from("quotes")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "status",
          "awaiting_parts",
        ),

      supabase
        .from("quotes")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "status",
          "in_progress",
        ),

      supabase
        .from("quotes")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "status",
          "completed",
        ),

      supabase
        .from("quotes")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "priority",
          "vehicle_stopped",
        )
        .in(
          "status",
          activeQuoteStatuses,
        ),

      supabase
        .from("quotes")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "priority",
          "customer_waiting",
        )
        .in(
          "status",
          activeQuoteStatuses,
        ),

      supabase
        .from("purchase_orders")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "status",
          [
            "approved",
            "ordered",
            "partially_received",
          ],
        ),

      supabase
        .from("work_orders")
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "status",
          [
            "pending",
            "in_progress",
          ],
        ),

      supabase
        .from("quotes")
        .select(
          "id, protocol, customer_id, vehicle_id, status, priority, commercial_status, final_amount, created_at",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          10,
        ),

      supabase
        .from("customers")
        .select(
          "id, name, phone",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from("vehicles")
        .select(
          "id, plate, brand, model",
        )
        .eq(
          "organization_id",
          organization.id,
        ),
    ]);


  const results = [
    awaitingQuoteResult,
    awaitingCustomerResult,
    awaitingPartsResult,
    inProgressResult,
    completedResult,
    vehicleStoppedResult,
    customerWaitingResult,
    purchasesOpenResult,
    workOrdersActiveResult,
    recentQuotesResult,
    customersResult,
    vehiclesResult,
  ];


  for (
    const result
    of results
  ) {

    if (
      result.error
    ) {

      throw new Error(
        result.error.message,
      );
    }
  }


  const recentQuotes =
    recentQuotesResult.data ??
    [];


  const customers =
    new Map(
      (
        customersResult.data ??
        []
      ).map(
        (customer) =>
          [
            customer.id,
            customer,
          ] as const,
      ),
    );


  const vehicles =
    new Map(
      (
        vehiclesResult.data ??
        []
      ).map(
        (vehicle) =>
          [
            vehicle.id,
            vehicle,
          ] as const,
      ),
    );


  const primaryMetrics = [
    {
      label:
        "Aguardando cotação",

      value:
        awaitingQuoteResult.count,

      description:
        "Peças aguardando fluxo de fornecedores.",

      href:
        "/dashboard/cotacoes",

      icon:
        "↗",
    },
    {
      label:
        "Aguardando cliente",

      value:
        awaitingCustomerResult.count,

      description:
        "Orçamentos comerciais esperando decisão.",

      href:
        "/dashboard/comercial",

      icon:
        "◎",
    },
    {
      label:
        "Aguardando peças",

      value:
        awaitingPartsResult.count,

      description:
        "Aprovados e liberados para compras.",

      href:
        "/dashboard/compras",

      icon:
        "□",
    },
    {
      label:
        "Em execução",

      value:
        inProgressResult.count,

      description:
        "Veículos em serviço na oficina.",

      href:
        "/dashboard/execucao",

      icon:
        "▶",
    },
  ];


  const attentionItems = [
    {
      label:
        "Veículos parados",

      value:
        vehicleStoppedResult.count,

      href:
        "/dashboard/orcamentos",

      tone:
        "danger",
    },
    {
      label:
        "Clientes aguardando",

      value:
        customerWaitingResult.count,

      href:
        "/dashboard/orcamentos",

      tone:
        "warning",
    },
    {
      label:
        "Compras abertas",

      value:
        purchasesOpenResult.count,

      href:
        "/dashboard/compras",

      tone:
        "default",
    },
    {
      label:
        "OS ativas",

      value:
        workOrdersActiveResult.count,

      href:
        "/dashboard/execucao",

      tone:
        "default",
    },
  ];


  return (
    <div className="orbiq-page ops-dashboard">

      <section className="ops-hero">

        <div>

          <span className="orbiq-eyebrow">
            CENTRAL OPERACIONAL
          </span>

          <h1>
            {organization.name}
          </h1>

          <p>
            Acompanhe o fluxo da oficina do orçamento à entrega.
          </p>

        </div>


        <div className="ops-hero-actions">

          <Link
            href="/dashboard/orcamentos/novo"
            className="orbiq-primary-button"
          >
            + Novo orçamento
          </Link>


          <Link
            href="/dashboard/orcamentos"
            className="orbiq-secondary-button"
          >
            Ver orçamentos
          </Link>

        </div>

      </section>


      <section className="ops-primary-grid">

        {primaryMetrics.map(
          (metric) => (

            <Link
              key={
                metric.label
              }
              href={
                metric.href
              }
              className="ops-primary-card"
            >

              <div className="ops-primary-card-top">

                <span className="ops-primary-icon">
                  {metric.icon}
                </span>

                <span className="ops-primary-arrow">
                  →
                </span>

              </div>


              <strong>
                {count(
                  metric.value,
                )}
              </strong>


              <div>

                <span>
                  {metric.label}
                </span>

                <small>
                  {metric.description}
                </small>

              </div>

            </Link>

          ),
        )}

      </section>


      <section className="ops-grid-main">

        <article className="orbiq-panel ops-pipeline-panel">

          <div className="orbiq-panel-heading">

            <div>

              <span className="orbiq-eyebrow">
                PIPELINE
              </span>

              <h2>
                Fluxo da oficina
              </h2>

            </div>


            <Link
              href="/dashboard/orcamentos"
              className="orbiq-inline-link"
            >
              Ver todos
            </Link>

          </div>


          <div className="ops-pipeline">

            <Link
              href="/dashboard/cotacoes"
              className="ops-pipeline-step"
            >

              <span>
                01
              </span>

              <div>

                <strong>
                  Cotação
                </strong>

                <small>
                  {count(
                    awaitingQuoteResult.count,
                  )} pendente(s)
                </small>

              </div>

            </Link>


            <span className="ops-pipeline-connector">
              →
            </span>


            <Link
              href="/dashboard/comercial"
              className="ops-pipeline-step"
            >

              <span>
                02
              </span>

              <div>

                <strong>
                  Cliente
                </strong>

                <small>
                  {count(
                    awaitingCustomerResult.count,
                  )} aguardando
                </small>

              </div>

            </Link>


            <span className="ops-pipeline-connector">
              →
            </span>


            <Link
              href="/dashboard/compras"
              className="ops-pipeline-step"
            >

              <span>
                03
              </span>

              <div>

                <strong>
                  Compras
                </strong>

                <small>
                  {count(
                    awaitingPartsResult.count,
                  )} veículo(s)
                </small>

              </div>

            </Link>


            <span className="ops-pipeline-connector">
              →
            </span>


            <Link
              href="/dashboard/execucao"
              className="ops-pipeline-step"
            >

              <span>
                04
              </span>

              <div>

                <strong>
                  Execução
                </strong>

                <small>
                  {count(
                    inProgressResult.count,
                  )} em serviço
                </small>

              </div>

            </Link>


            <span className="ops-pipeline-connector">
              →
            </span>


            <div className="ops-pipeline-step is-complete">

              <span>
                05
              </span>

              <div>

                <strong>
                  Finalizados
                </strong>

                <small>
                  {count(
                    completedResult.count,
                  )} concluído(s)
                </small>

              </div>

            </div>

          </div>

        </article>


        <article className="orbiq-panel ops-attention-panel">

          <div className="orbiq-panel-heading">

            <div>

              <span className="orbiq-eyebrow">
                AGORA
              </span>

              <h2>
                Atenção operacional
              </h2>

            </div>

          </div>


          <div className="ops-attention-list">

            {attentionItems.map(
              (item) => (

                <Link
                  key={
                    item.label
                  }
                  href={
                    item.href
                  }
                  className={
                    `ops-attention-row tone-${item.tone}`
                  }
                >

                  <div>

                    <strong>
                      {item.label}
                    </strong>

                    <span>
                      Abrir módulo
                    </span>

                  </div>


                  <b>
                    {count(
                      item.value,
                    )}
                  </b>

                </Link>

              ),
            )}

          </div>

        </article>

      </section>


      <section className="ops-action-grid">

        <Link
          href="/dashboard/orcamentos/novo"
          className="ops-action"
        >

          <span>
            +
          </span>

          <div>

            <strong>
              Novo orçamento
            </strong>

            <small>
              Inicie um atendimento.
            </small>

          </div>

          <b>
            →
          </b>

        </Link>


        <Link
          href="/dashboard/cotacoes"
          className="ops-action"
        >

          <span>
            ↗
          </span>

          <div>

            <strong>
              Cotações
            </strong>

            <small>
              Fornecedores e respostas.
            </small>

          </div>

          <b>
            →
          </b>

        </Link>


        <Link
          href="/dashboard/comercial"
          className="ops-action"
        >

          <span>
            $
          </span>

          <div>

            <strong>
              Comercial
            </strong>

            <small>
              Venda e decisão do cliente.
            </small>

          </div>

          <b>
            →
          </b>

        </Link>


        <Link
          href="/dashboard/compras"
          className="ops-action"
        >

          <span>
            □
          </span>

          <div>

            <strong>
              Compras
            </strong>

            <small>
              Pedidos e recebimentos.
            </small>

          </div>

          <b>
            →
          </b>

        </Link>


        <Link
          href="/dashboard/execucao"
          className="ops-action"
        >

          <span>
            ▶
          </span>

          <div>

            <strong>
              Execução
            </strong>

            <small>
              Ordens de serviço.
            </small>

          </div>

          <b>
            →
          </b>

        </Link>

      </section>


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              RECENTES
            </span>

            <h2>
              Últimos orçamentos
            </h2>

          </div>


          <Link
            href="/dashboard/orcamentos"
            className="orbiq-inline-link"
          >
            Histórico completo
          </Link>

        </div>


        {recentQuotes.length ===
        0 ? (

          <div className="orbiq-empty">

            <strong>
              Nenhum orçamento criado ainda.
            </strong>

            <span>
              O primeiro atendimento aparecerá aqui.
            </span>


            <Link
              href="/dashboard/orcamentos/novo"
              className="orbiq-primary-button"
            >
              Criar orçamento
            </Link>

          </div>

        ) : (

          <div className="ops-recent-list">

            {recentQuotes.map(
              (quote) => {

                const customer =
                  customers.get(
                    quote.customer_id,
                  );


                const vehicle =
                  vehicles.get(
                    quote.vehicle_id,
                  );


                return (
                  <Link
                    key={
                      quote.id
                    }
                    href={
                      `/dashboard/orcamentos/${quote.id}`
                    }
                    className="ops-recent-row"
                  >

                    <div className="ops-recent-protocol">

                      <strong>
                        {quote.protocol}
                      </strong>

                      <span>
                        {dateTime(
                          quote.created_at,
                        )}
                      </span>

                    </div>


                    <div>

                      <strong>
                        {customer?.name ??
                          "Cliente"}
                      </strong>

                      <span>
                        {customer?.phone ??
                          "Sem telefone"}
                      </span>

                    </div>


                    <div>

                      <strong className="ops-recent-plate">
                        {vehicle?.plate ??
                          "—"}
                      </strong>

                      <span>
                        {[
                          vehicle?.brand,
                          vehicle?.model,
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                          "Veículo"}
                      </span>

                    </div>


                    <div className="ops-status-stack">

                      <span
                        className={
                          `quote-status status-${quote.status}`
                        }
                      >
                        {statusLabel(
                          quote.status,
                        )}
                      </span>

                      <small>
                        {commercialLabel(
                          quote.commercial_status,
                        )}
                      </small>

                    </div>


                    <span
                      className={
                        `ops-priority priority-${quote.priority}`
                      }
                    >
                      {priorityLabel(
                        quote.priority,
                      )}
                    </span>


                    <strong className="ops-recent-value">
                      {money(
                        quote.final_amount,
                      )}
                    </strong>


                    <strong className="ops-recent-arrow">
                      →
                    </strong>

                  </Link>
                );
              },
            )}

          </div>

        )}

      </section>

    </div>
  );
}