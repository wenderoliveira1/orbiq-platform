import Link from "next/link";

import {
  getCurrentContext,
} from "../_lib/current-organization";

import {
  statusLabel,
} from "../orcamentos/quote-meta";


function currency(
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


function commercialLabel(
  value:
    string,
): string {

  const labels:
    Record<string, string> = {

    draft:
      "Não montado",

    ready:
      "Aguardando cliente",

    approved:
      "Aprovado",

    rejected:
      "Reprovado",
  };


  return (
    labels[
      value
    ] ??
    value
  );
}


export default async function CommercialPage() {

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
    itemsResult,
  ] =
    await Promise.all([

      supabase
        .from("quotes")
        .select(
          "id, protocol, customer_id, vehicle_id, status, commercial_status, parts_cost_amount, parts_sale_amount, labor_sale_amount, subtotal_amount, discount_amount, final_amount, created_at",
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
          200,
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
        .from("quote_items")
        .select(
          "id, quote_id, chosen_amount, sale_total_amount",
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
      itemsResult,
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


  const serviceCount =
    new Map<
      string,
      number
    >();


  for (
    const service
    of servicesResult.data ??
    []
  ) {

    serviceCount.set(
      service.quote_id,
      (
        serviceCount.get(
          service.quote_id,
        ) ??
        0
      ) +
      1,
    );
  }


  const itemStats =
    new Map<
      string,
      {
        total:
          number;

        costReady:
          number;

        saleReady:
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

        costReady:
          0,

        saleReady:
          0,
      };


    current.total +=
      1;


    if (
      item.chosen_amount !==
      null
    ) {

      current.costReady +=
        1;
    }


    if (
      item.sale_total_amount !==
      null
    ) {

      current.saleReady +=
        1;
    }


    itemStats.set(
      item.quote_id,
      current,
    );
  }


  const quotes =
    (
      quotesResult.data ??
      []
    ).filter(
      (quote) =>
        (
          serviceCount.get(
            quote.id,
          ) ??
          0
        ) >
        0,
    );


  const waitingCustomer =
    quotes.filter(
      (quote) =>
        quote.commercial_status ===
        "ready",
    ).length;


  const approved =
    quotes.filter(
      (quote) =>
        quote.commercial_status ===
        "approved",
    ).length;


  const rejected =
    quotes.filter(
      (quote) =>
        quote.commercial_status ===
        "rejected",
    ).length;


  const draft =
    quotes.filter(
      (quote) =>
        quote.commercial_status ===
        "draft",
    ).length;


  return (
    <div className="orbiq-page">

      <section className="orbiq-page-heading">

        <div>

          <span className="orbiq-eyebrow">
            COMERCIAL
          </span>

          <h1>
            Orçamentos do cliente
          </h1>

          <p>
            Defina preço de venda, margem e desconto antes de liberar qualquer compra.
          </p>

        </div>

      </section>


      <section className="commercial-metrics">

        <article>

          <span>
            Para montar
          </span>

          <strong>
            {draft}
          </strong>

        </article>


        <article>

          <span>
            Aguardando cliente
          </span>

          <strong>
            {waitingCustomer}
          </strong>

        </article>


        <article>

          <span>
            Aprovados
          </span>

          <strong>
            {approved}
          </strong>

        </article>


        <article>

          <span>
            Reprovados
          </span>

          <strong>
            {rejected}
          </strong>

        </article>

      </section>


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              ORÇAMENTOS
            </span>

            <h2>
              Central comercial
            </h2>

          </div>

          <span className="orbiq-count-badge">
            {quotes.length}
          </span>

        </div>


        {quotes.length ===
        0 ? (

          <div className="orbiq-empty">

            <strong>
              Nenhum orçamento disponível.
            </strong>

            <span>
              Crie um orçamento para iniciar o fluxo comercial.
            </span>

          </div>

        ) : (

          <div className="commercial-list">

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


                const stats =
                  itemStats.get(
                    quote.id,
                  ) ??
                  {
                    total:
                      0,

                    costReady:
                      0,

                    saleReady:
                      0,
                  };


                const supplierReady =
                  stats.total ===
                    0 ||
                  stats.costReady ===
                    stats.total;


                return (
                  <Link
                    key={
                      quote.id
                    }
                    href={
                      `/dashboard/comercial/${quote.id}`
                    }
                    className="commercial-row"
                  >

                    <div>

                      <strong>
                        {quote.protocol}
                      </strong>

                      <span>
                        {customer?.name ??
                          "Cliente"}
                      </span>

                    </div>


                    <div>

                      <strong className="commercial-plate">
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

                      <span>
                        Fluxo
                      </span>

                      <strong>
                        {statusLabel(
                          quote.status,
                        )}
                      </strong>

                    </div>


                    <div>

                      <span>
                        Fornecedores
                      </span>

                      <strong
                        className={
                          supplierReady
                            ? "commercial-ready"
                            : "commercial-pending"
                        }
                      >
                        {stats.total ===
                        0
                          ? "Sem peças"
                          : `${stats.costReady}/${stats.total}`}
                      </strong>

                    </div>


                    <div>

                      <span>
                        Comercial
                      </span>

                      <strong>
                        {commercialLabel(
                          quote.commercial_status,
                        )}
                      </strong>

                    </div>


                    <div>

                      <span>
                        Total cliente
                      </span>

                      <strong className="commercial-total-value">
                        {currency(
                          quote.final_amount,
                        )}
                      </strong>

                    </div>


                    <strong className="commercial-row-arrow">
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