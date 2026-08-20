import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  getCurrentContext,
} from "../../_lib/current-organization";

import {
  statusLabel,
} from "../../orcamentos/quote-meta";

import {
  completeServiceAction,
  setLaborAction,
  startServiceAction,
} from "./actions";


type PageProps = {

  params:
    Promise<{
      workOrderId:
        string;
    }>;

  searchParams:
    Promise<{
      ok?: string;
      error?: string;
    }>;
};


function currency(
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
    },
  ).format(
    value,
  );
}


function dateTime(
  value:
    string |
    null,
): string {

  if (!value) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

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


function osStatus(
  value:
    string,
): string {

  const labels:
    Record<string, string> = {

    pending:
      "Pendente",

    in_progress:
      "Em execução",

    completed:
      "Concluída",

    cancelled:
      "Cancelada",
  };


  return (
    labels[
      value
    ] ??
    value
  );
}


function serviceStatus(
  value:
    string,
): string {

  const labels:
    Record<string, string> = {

    pending:
      "Pendente",

    in_progress:
      "Em execução",

    completed:
      "Concluído",
  };


  return (
    labels[
      value
    ] ??
    value
  );
}


export default async function WorkOrderPage({
  params,
  searchParams,
}: PageProps) {

  const {
    workOrderId,
  } =
    await params;


  const query =
    await searchParams;


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    data: workOrder,
    error: orderError,
  } =
    await supabase
      .from("work_orders")
      .select(
        "id, quote_id, code, status, started_at, completed_at, notes, created_at",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        workOrderId,
      )
      .maybeSingle();


  if (orderError) {

    throw new Error(
      `Falha ao carregar OS: ${orderError.message}`,
    );
  }


  if (!workOrder) {

    notFound();
  }


  const {
    data: quote,
    error: quoteError,
  } =
    await supabase
      .from("quotes")
      .select(
        "id, protocol, customer_id, vehicle_id, status, priority, mileage",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        workOrder.quote_id,
      )
      .maybeSingle();


  if (
    quoteError ||
    !quote
  ) {

    throw new Error(
      quoteError?.message ??
        "Orçamento da OS não encontrado.",
    );
  }


  const [
    customerResult,
    vehicleResult,
    servicesResult,
    laborResult,
  ] =
    await Promise.all([

      supabase
        .from("customers")
        .select(
          "id, name, phone",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "id",
          quote.customer_id,
        )
        .maybeSingle(),

      supabase
        .from("vehicles")
        .select(
          "id, plate, brand, model, version, model_year",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "id",
          quote.vehicle_id,
        )
        .maybeSingle(),

      supabase
        .from("work_order_services")
        .select(
          "id, quote_service_id, labor_service_id, category, description, labor_amount, needs_part, status, notes, started_at, completed_at, created_at",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "work_order_id",
          workOrder.id,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from("labor_services")
        .select(
          "id, description, category, amount, active",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "active",
          true,
        )
        .order(
          "description",
          {
            ascending:
              true,
          },
        ),
    ]);


  for (
    const result
    of [
      customerResult,
      vehicleResult,
      servicesResult,
      laborResult,
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


  const customer =
    customerResult.data;


  const vehicle =
    vehicleResult.data;


  const services =
    servicesResult.data ??
    [];


  const laborServices =
    laborResult.data ??
    [];


  const laborMap =
    new Map(
      laborServices.map(
        (item) =>
          [
            item.id,
            item,
          ] as const,
      ),
    );


  const pending =
    services.filter(
      (service) =>
        service.status ===
        "pending",
    ).length;


  const running =
    services.filter(
      (service) =>
        service.status ===
        "in_progress",
    ).length;


  const completed =
    services.filter(
      (service) =>
        service.status ===
        "completed",
    ).length;


  const progress =
    services.length >
    0
      ? Math.round(
          (
            completed /
            services.length
          ) *
            100,
        )
      : 0;


  const laborTotal =
    services.reduce(
      (
        total,
        service,
      ) =>
        total +
        service.labor_amount,
      0,
    );


  const awaitingParts =
    quote.status ===
    "awaiting_parts";


  const quoteCompleted =
    quote.status ===
    "completed";


  return (
    <div className="orbiq-page">

      <section className="work-order-heading">

        <div>

          <Link
            href="/dashboard/execucao"
            className="quote-back-link"
          >
            ← Execução
          </Link>

          <span className="orbiq-eyebrow">
            ORDEM DE SERVIÇO
          </span>

          <h1>
            {workOrder.code}
          </h1>

          <p>
            {quote.protocol}{" · "}

            {customer?.name ??
              "Cliente"}{" · "}

            {vehicle?.plate ??
              "Sem placa"}
          </p>

        </div>


        <div className="work-order-heading-actions">

          <span
            className={
              `work-status work-${workOrder.status}`
            }
          >
            {osStatus(
              workOrder.status,
            )}
          </span>

          <Link
            href={
              `/dashboard/orcamentos/${quote.id}`
            }
            className="orbiq-secondary-button"
          >
            Ver orçamento
          </Link>

        </div>

      </section>


      {query.ok ? (

        <div className="orbiq-alert success">
          {query.ok}
        </div>

      ) : null}


      {query.error ? (

        <div className="orbiq-alert error">
          {query.error}
        </div>

      ) : null}


      {awaitingParts ? (

        <section className="work-order-blocked">

          <div className="work-order-blocked-icon">
            !
          </div>

          <div>

            <strong>
              Execução aguardando peças
            </strong>

            <span>
              Os serviços permanecem visíveis, mas não podem ser iniciados enquanto houver material pendente na área de Compras.
            </span>

          </div>


          <Link
            href="/dashboard/compras"
            className="orbiq-secondary-button"
          >
            Ver compras
          </Link>

        </section>

      ) : null}


      {quoteCompleted ? (

        <section className="work-order-complete-banner">

          <div>

            <span className="orbiq-eyebrow">
              VEÍCULO FINALIZADO
            </span>

            <strong>
              Todos os serviços desta ordem foram concluídos.
            </strong>

            <span>
              O orçamento também foi atualizado automaticamente para Finalizado.
            </span>

          </div>

        </section>

      ) : null}


      <section className="work-order-vehicle-grid">

        <article className="orbiq-panel">

          <span className="orbiq-eyebrow">
            VEÍCULO
          </span>

          <div className="work-order-vehicle-title">

            <span className="orbiq-plate">
              {vehicle?.plate ??
                "—"}
            </span>

            <h2>
              {[
                vehicle?.brand,
                vehicle?.model,
                vehicle?.version,
              ]
                .filter(Boolean)
                .join(" ") ||
                "Veículo"}
            </h2>

          </div>


          <div className="quote-detail-info">

            <span>
              Ano
            </span>

            <strong>
              {vehicle?.model_year ??
                "—"}
            </strong>


            <span>
              Quilometragem
            </span>

            <strong>
              {quote.mileage !==
              null
                ? `${new Intl.NumberFormat(
                    "pt-BR",
                  ).format(
                    quote.mileage,
                  )} km`
                : "—"}
            </strong>

          </div>

        </article>


        <article className="orbiq-panel">

          <span className="orbiq-eyebrow">
            CLIENTE
          </span>

          <h2 className="work-order-customer-name">
            {customer?.name ??
              "Cliente não localizado"}
          </h2>


          <div className="quote-detail-info">

            <span>
              Telefone
            </span>

            <strong>
              {customer?.phone ??
                "—"}
            </strong>


            <span>
              Orçamento
            </span>

            <strong>
              {quote.protocol}
            </strong>

          </div>

        </article>

      </section>


      <section className="work-order-metrics">

        <article>

          <span>
            Pendentes
          </span>

          <strong>
            {pending}
          </strong>

        </article>


        <article>

          <span>
            Em execução
          </span>

          <strong>
            {running}
          </strong>

        </article>


        <article>

          <span>
            Concluídos
          </span>

          <strong>
            {completed}
          </strong>

        </article>


        <article>

          <span>
            Mão de obra
          </span>

          <strong>
            {currency(
              laborTotal,
            )}
          </strong>

        </article>

      </section>


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              PROGRESSO
            </span>

            <h2>
              Execução do veículo
            </h2>

          </div>


          <strong className="work-order-progress-number">
            {progress}%
          </strong>

        </div>


        <div className="work-order-progress">

          <span
            style={{
              width:
                `${progress}%`,
            }}
          />

        </div>

      </section>


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              SERVIÇOS
            </span>

            <h2>
              Ordem de execução
            </h2>

          </div>

          <span className="orbiq-count-badge">
            {services.length}
          </span>

        </div>


        {services.length ===
        0 ? (

          <div className="orbiq-empty">

            <strong>
              Nenhum serviço na OS.
            </strong>

          </div>

        ) : (

          <div className="work-service-list">

            {services.map(
              (service) => {

                const selectedLabor =
                  service.labor_service_id
                    ? laborMap.get(
                        service.labor_service_id,
                      )
                    : undefined;


                return (
                  <article
                    key={
                      service.id
                    }
                    className={
                      `work-service-card service-${service.status}`
                    }
                  >

                    <div className="work-service-status-icon">

                      {service.status ===
                      "completed"
                        ? "✓"
                        : service.status ===
                          "in_progress"
                          ? "▶"
                          : ""}

                    </div>


                    <div className="work-service-main">

                      <span className="orbiq-eyebrow">
                        {service.category ??
                          "SERVIÇO"}
                      </span>

                      <h3>
                        {service.description}
                      </h3>


                      <div className="work-service-meta">

                        <span
                          className={
                            `work-service-status status-${service.status}`
                          }
                        >
                          {serviceStatus(
                            service.status,
                          )}
                        </span>


                        {service.needs_part ? (

                          <span className="work-service-part">
                            Exige peça
                          </span>

                        ) : null}


                        <span>
                          Mão de obra:{" "}

                          <strong>
                            {currency(
                              service.labor_amount,
                            )}
                          </strong>
                        </span>

                      </div>


                      {selectedLabor ? (

                        <div className="work-service-labor-linked">

                          <span>
                            Mão de obra vinculada
                          </span>

                          <strong>
                            {selectedLabor.description}
                          </strong>

                          <small>
                            {selectedLabor.category ??
                              "Sem categoria"}
                          </small>

                        </div>

                      ) : service.status ===
                      "pending" &&
                      laborServices.length >
                      0 ? (

                        <form
                          action={
                            setLaborAction
                          }
                          className="work-labor-selector"
                        >

                          <input
                            type="hidden"
                            name="work_order_id"
                            value={
                              workOrder.id
                            }
                          />

                          <input
                            type="hidden"
                            name="quote_id"
                            value={
                              quote.id
                            }
                          />

                          <input
                            type="hidden"
                            name="work_order_service_id"
                            value={
                              service.id
                            }
                          />


                          <select
                            name="labor_service_id"
                            required
                            defaultValue=""
                          >

                            <option
                              value=""
                              disabled
                            >
                              Vincular mão de obra...
                            </option>


                            {laborServices.map(
                              (
                                labor,
                              ) => (

                                <option
                                  key={
                                    labor.id
                                  }
                                  value={
                                    labor.id
                                  }
                                >
                                  {labor.description}
                                  {" — "}
                                  {currency(
                                    labor.amount,
                                  )}
                                </option>

                              ),
                            )}

                          </select>


                          <button
                            type="submit"
                            className="orbiq-secondary-button"
                          >
                            Vincular
                          </button>

                        </form>

                      ) : !selectedLabor ? (

                        <div className="work-service-no-labor">

                          <span>
                            Mão de obra não vinculada
                          </span>

                        </div>

                      ) : null}

                    </div>


                    <div className="work-service-actions">

                      {service.status ===
                      "pending" &&
                      !quoteCompleted ? (

                        <form
                          action={
                            startServiceAction
                          }
                        >

                          <input
                            type="hidden"
                            name="work_order_id"
                            value={
                              workOrder.id
                            }
                          />

                          <input
                            type="hidden"
                            name="quote_id"
                            value={
                              quote.id
                            }
                          />

                          <input
                            type="hidden"
                            name="work_order_service_id"
                            value={
                              service.id
                            }
                          />


                          <button
                            type="submit"
                            className="orbiq-primary-button"
                            disabled={
                              awaitingParts
                            }
                          >
                            Iniciar serviço
                          </button>

                        </form>

                      ) : null}


                      {service.status ===
                      "in_progress" ? (

                        <form
                          action={
                            completeServiceAction
                          }
                        >

                          <input
                            type="hidden"
                            name="work_order_id"
                            value={
                              workOrder.id
                            }
                          />

                          <input
                            type="hidden"
                            name="quote_id"
                            value={
                              quote.id
                            }
                          />

                          <input
                            type="hidden"
                            name="work_order_service_id"
                            value={
                              service.id
                            }
                          />


                          <button
                            type="submit"
                            className="orbiq-primary-button"
                          >
                            Concluir
                          </button>

                        </form>

                      ) : null}


                      {service.status ===
                      "completed" ? (

                        <div className="work-service-done">

                          <strong>
                            Concluído
                          </strong>

                          <span>
                            {dateTime(
                              service.completed_at,
                            )}
                          </span>

                        </div>

                      ) : null}

                    </div>

                  </article>
                );
              },
            )}

          </div>

        )}

      </section>


      <section className="work-order-footer-info">

        <div>

          <span>
            Status da OS
          </span>

          <strong>
            {osStatus(
              workOrder.status,
            )}
          </strong>

        </div>


        <div>

          <span>
            Status do orçamento
          </span>

          <strong>
            {statusLabel(
              quote.status,
            )}
          </strong>

        </div>


        <div>

          <span>
            OS criada
          </span>

          <strong>
            {dateTime(
              workOrder.created_at,
            )}
          </strong>

        </div>


        <div>

          <span>
            Iniciada
          </span>

          <strong>
            {dateTime(
              workOrder.started_at,
            )}
          </strong>

        </div>


        <div>

          <span>
            Finalizada
          </span>

          <strong>
            {dateTime(
              workOrder.completed_at,
            )}
          </strong>

        </div>

      </section>

    </div>
  );
}