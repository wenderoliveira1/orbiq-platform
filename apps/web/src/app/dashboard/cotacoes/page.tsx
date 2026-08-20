import Link from "next/link";

import {
  getCurrentContext,
} from "../_lib/current-organization";

import {
  statusLabel,
} from "../orcamentos/quote-meta";


function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}


export default async function QuoteCenterPage() {
  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const [
    quotesResult,
    customersResult,
    vehiclesResult,
    itemsResult,
    requestsResult,
  ] =
    await Promise.all([
      supabase
        .from("quotes")
        .select(
          "id, customer_id, vehicle_id, protocol, status, created_at",
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
          100,
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
        .from("quote_items")
        .select(
          "id, quote_id, supplier_id, purchase_status",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from(
          "quote_supplier_requests",
        )
        .select(
          "id, quote_id, status",
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
      itemsResult,
      requestsResult,
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


  const itemStats =
    new Map<
      string,
      {
        total:
          number;

        selected:
          number;
      }
    >();


  for (
    const item
    of itemsResult.data ??
    []
  ) {

    const current =
      itemStats.get(
        item.quote_id,
      ) ??
      {
        total:
          0,

        selected:
          0,
      };


    current.total +=
      1;


    if (
      item.supplier_id
    ) {

      current.selected +=
        1;
    }


    itemStats.set(
      item.quote_id,
      current,
    );
  }


  const requestStats =
    new Map<
      string,
      {
        total:
          number;

        opened:
          number;

        responded:
          number;
      }
    >();


  for (
    const request
    of requestsResult.data ??
    []
  ) {

    if (
      request.status ===
      "cancelled"
    ) {

      continue;
    }


    const current =
      requestStats.get(
        request.quote_id,
      ) ??
      {
        total:
          0,

        opened:
          0,

        responded:
          0,
      };


    current.total +=
      1;


    if (
      [
        "opened",
        "responded",
        "won",
        "lost",
      ].includes(
        request.status,
      )
    ) {

      current.opened +=
        1;
    }


    if (
      [
        "responded",
        "won",
        "lost",
      ].includes(
        request.status,
      )
    ) {

      current.responded +=
        1;
    }


    requestStats.set(
      request.quote_id,
      current,
    );
  }


  const quotes =
    quotesResult.data ??
    [];


  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">
            COTAÇÕES
          </span>

          <h1>
            Central de compras
          </h1>

          <p>
            Envie solicitações, registre respostas, compare fornecedores e aprove as compras.
          </p>
        </div>
      </section>


      <section className="orbiq-panel">
        <div className="orbiq-panel-heading">
          <div>
            <span className="orbiq-eyebrow">
              ORÇAMENTOS
            </span>

            <h2>
              Fluxo de cotações
            </h2>
          </div>
        </div>


        {quotes.length ===
        0 ? (
          <div className="orbiq-empty">
            <strong>
              Nenhum orçamento.
            </strong>

            <Link
              href="/dashboard/orcamentos/novo"
              className="orbiq-primary-button"
            >
              Novo orçamento
            </Link>
          </div>
        ) : (
          <div className="quote-center-list">
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


                const item =
                  itemStats.get(
                    quote.id,
                  ) ??
                  {
                    total:
                      0,

                    selected:
                      0,
                  };


                const request =
                  requestStats.get(
                    quote.id,
                  ) ??
                  {
                    total:
                      0,

                    opened:
                      0,

                    responded:
                      0,
                  };


                return (
                  <article
                    key={
                      quote.id
                    }
                    className="quote-center-row quote-center-row-v2"
                  >
                    <div>
                      <strong>
                        {quote.protocol}
                      </strong>

                      <span>
                        {formatDate(
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
                        {[
                          vehicle?.plate,
                          vehicle?.brand,
                          vehicle?.model,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>


                    <div className="quote-center-counts">
                      <span>
                        <b>
                          {item.total}
                        </b>

                        peças
                      </span>

                      <span>
                        <b>
                          {request.responded}/
                          {request.total}
                        </b>

                        respostas
                      </span>

                      <span>
                        <b>
                          {item.selected}/
                          {item.total}
                        </b>

                        escolhidas
                      </span>
                    </div>


                    <span
                      className={
                        `quote-status status-${quote.status}`
                      }
                    >
                      {statusLabel(
                        quote.status,
                      )}
                    </span>


                    <div className="quote-center-actions">
                      {item.total >
                      0 ? (
                        <>
                          <Link
                            href={
                              `/dashboard/cotacoes/${quote.id}`
                            }
                            className="orbiq-secondary-button"
                          >
                            Envio
                          </Link>

                          <Link
                            href={
                              `/dashboard/cotacoes/${quote.id}/respostas`
                            }
                            className="orbiq-primary-button"
                          >
                            Respostas
                          </Link>
                        </>
                      ) : (
                        <span className="quote-no-items">
                          Sem peças
                        </span>
                      )}
                    </div>
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