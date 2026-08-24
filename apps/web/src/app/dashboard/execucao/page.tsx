import Link from "next/link";

import {
  getCurrentContext,
} from "../_lib/current-organization";

import {
  statusLabel,
} from "../orcamentos/quote-meta";

import {
  createWorkOrderAction,
} from "./actions";


type SearchParams =
  Promise<{
    error?: string;
  }>;



export default async function ExecutionPage({
  searchParams,
}: {
  searchParams:
    SearchParams;
}) {

  const query =
    await searchParams;


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const [
    quotesResult,
    customersResult,
    vehiclesResult,
    servicesResult,
    workOrdersResult,
    workServicesResult,
  ] =
    await Promise.all([

      supabase
        .from("quotes")
        .select(
          "id, protocol, customer_id, vehicle_id, status, priority, created_at",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "status",
          [
            "approved",
            "awaiting_parts",
            "in_progress",
            "completed",
          ],
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          150,
        ),

      supabase
        .from("customers")
        .select(
          "id, name",
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

      supabase
        .from("quote_services")
        .select(
          "id, quote_id",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from("work_orders")
        .select(
          "id, quote_id, code, status, started_at, completed_at, created_at",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .neq(
          "status",
          "cancelled",
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        ),

      supabase
        .from("work_order_services")
        .select(
          "id, work_order_id, status",
        )
        .eq(
          "organization_id",
          organization.id,
        ),
    ]);


  for (
    const result
    of [
      quotesResult,
      customersResult,
      vehiclesResult,
      servicesResult,
      workOrdersResult,
      workServicesResult,
    ]
  ) {

    if (
      result.error
    ) {

      throw new Error(
        result.error.message,
      );
    }
  }


  const customers =
    new Map(
      (
        customersResult.data ??
        []
      ).map(
        (item) =>
          [
            item.id,
            item,
          ] as const,
      ),
    );


  const vehicles =
    new Map(
      (
        vehiclesResult.data ??
        []
      ).map(
        (item) =>
          [
            item.id,
            item,
          ] as const,
      ),
    );


  const servicesByQuote =
    new Map<
      string,
      number
    >();


  for (
    const service
    of servicesResult.data ??
    []
  ) {

    servicesByQuote.set(
      service.quote_id,
      (
        servicesByQuote.get(
          service.quote_id,
        ) ??
        0
      ) +
      1,
    );
  }


  const workOrders =
    workOrdersResult.data ??
    [];


  const workOrderByQuote =
    new Map(
      workOrders.map(
        (order) =>
          [
            order.quote_id,
            order,
          ] as const,
      ),
    );


  const workStats =
    new Map<
      string,
      {
        total: number;
        pending: number;
        running: number;
        completed: number;
      }
    >();


  for (
    const service
    of workServicesResult.data ??
    []
  ) {

    const current =
      workStats.get(
        service.work_order_id,
      ) ??
      {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
      };


    current.total +=
      1;


    if (
      service.status ===
      "pending"
    ) {

      current.pending +=
        1;
    }


    if (
      service.status ===
      "in_progress"
    ) {

      current.running +=
        1;
    }


    if (
      service.status ===
      "completed"
    ) {

      current.completed +=
        1;
    }


    workStats.set(
      service.work_order_id,
      current,
    );
  }


  const quotes =
    quotesResult.data ??
    [];


  const pendingOrders =
    workOrders.filter(
      (order) =>
        order.status ===
        "pending",
    ).length;


  const runningOrders =
    workOrders.filter(
      (order) =>
        order.status ===
        "in_progress",
    ).length;


  const completedOrders =
    workOrders.filter(
      (order) =>
        order.status ===
        "completed",
    ).length;


  return (
    <div className="orbiq-page">

      <section className="orbiq-page-heading">

        <div>

          <span className="orbiq-eyebrow">
            EXECUÇÃO
          </span>

          <h1>
            Operação da oficina
          </h1>

          <p>
            Transforme orçamentos aprovados em ordens de serviço e acompanhe cada trabalho até a conclusão.
          </p>

        </div>

      </section>


      {query.error ? (

        <div className="orbiq-alert error">
          {query.error}
        </div>

      ) : null}


      <section className="execution-metrics">

        <article>

          <span>
            OS pendentes
          </span>

          <strong>
            {pendingOrders}
          </strong>

        </article>


        <article>

          <span>
            Em execução
          </span>

          <strong>
            {runningOrders}
          </strong>

        </article>


        <article>

          <span>
            Concluídas
          </span>

          <strong>
            {completedOrders}
          </strong>

        </article>


        <article>

          <span>
            Total de OS
          </span>

          <strong>
            {workOrders.length}
          </strong>

        </article>

      </section>


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              VEÍCULOS
            </span>

            <h2>
              Ordens de serviço
            </h2>

          </div>

        </div>


        {quotes.length ===
        0 ? (

          <div className="orbiq-empty">

            <strong>
              Nenhum veículo pronto para execução.
            </strong>

            <span>
              Um orçamento aprovado aparecerá aqui automaticamente.
            </span>

          </div>

        ) : (

          <div className="execution-list">

            {quotes.map(
              (quote) => {

                const customer =
                  customers.get(
                    quote.customer_id,
                  );


                const vehicle =
                  vehicles.get(
                    quote.vehicle_id,
                  );


                const workOrder =
                  workOrderByQuote.get(
                    quote.id,
                  );


                const serviceCount =
                  servicesByQuote.get(
                    quote.id,
                  ) ??
                  0;


                const stats =
                  workOrder
                    ? workStats.get(
                        workOrder.id,
                      ) ??
                      {
                        total: 0,
                        pending: 0,
                        running: 0,
                        completed: 0,
                      }
                    : null;


                const progress =
                  stats &&
                  stats.total >
                  0
                    ? Math.round(
                        (
                          stats.completed /
                          stats.total
                        ) *
                          100,
                      )
                    : 0;


                return (
                  <article
                    key={
                      quote.id
                    }
                    className="execution-row"
                  >

                    <div>

                      <strong>
                        {vehicle?.plate ??
                          "—"}
                      </strong>

                      <span>
                        {[
                          vehicle?.brand,
                          vehicle?.model,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </span>

                    </div>


                    <div>

                      <strong>
                        {customer?.name ??
                          "Cliente"}
                      </strong>

                      <span>
                        {quote.protocol}
                      </span>

                    </div>


                    <div>

                      <span className="execution-label">
                        Orçamento
                      </span>

                      <span
                        className={
                          `quote-status status-${quote.status}`
                        }
                      >
                        {statusLabel(
                          quote.status,
                        )}
                      </span>

                    </div>


                    <div className="execution-service-count">

                      <strong>
                        {serviceCount}
                      </strong>

                      <span>
                        serviço(s)
                      </span>

                    </div>


                    {workOrder ? (

                      <div className="execution-row-progress">

                        <div>

                          <span
                            style={{
                              width:
                                `${progress}%`,
                            }}
                          />

                        </div>

                        <small>
                          {stats?.completed ?? 0}/
                          {stats?.total ?? 0} concluído(s)
                        </small>

                      </div>

                    ) : (

                      <span className="execution-no-os">
                        Sem OS
                      </span>

                    )}


                    {workOrder ? (

                      <Link
                        href={
                          `/dashboard/execucao/${workOrder.id}`
                        }
                        className="orbiq-primary-button"
                      >
                        Abrir OS
                      </Link>

                    ) : serviceCount >
                    0 &&
                    quote.status !==
                    "completed" ? (

                      <form
                        action={
                          createWorkOrderAction
                        }
                      >

                        <input
                          type="hidden"
                          name="quote_id"
                          value={
                            quote.id
                          }
                        />

                        <button
                          type="submit"
                          className="orbiq-primary-button"
                        >
                          Gerar OS
                        </button>

                      </form>

                    ) : (

                      <span className="execution-no-os">
                        Sem ação
                      </span>

                    )}

                  </article>
                );
              },
            )}

          </div>

        )}

      </section>

    </div>
  );
}