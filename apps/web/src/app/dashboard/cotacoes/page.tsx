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
            ascending: false,
          },
        )
        .limit(100),

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
          "id, quote_id, purchase_status",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from("quote_supplier_requests")
        .select(
          "id, quote_id, status",
        )
        .eq(
          "organization_id",
          organization.id,
        ),
    ]);


  if (quotesResult.error) {
    throw new Error(
      `Falha carregando orçamentos: ${quotesResult.error.message}`,
    );
  }


  if (customersResult.error) {
    throw new Error(
      `Falha carregando clientes: ${customersResult.error.message}`,
    );
  }


  if (vehiclesResult.error) {
    throw new Error(
      `Falha carregando veículos: ${vehiclesResult.error.message}`,
    );
  }


  if (itemsResult.error) {
    throw new Error(
      `Falha carregando peças: ${itemsResult.error.message}`,
    );
  }


  if (requestsResult.error) {
    throw new Error(
      `Falha carregando cotações: ${requestsResult.error.message}`,
    );
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


  const itemCounts =
    new Map<string, number>();


  for (
    const item
    of itemsResult.data ??
    []
  ) {
    itemCounts.set(
      item.quote_id,
      (
        itemCounts.get(
          item.quote_id,
        ) ??
        0
      ) +
      1,
    );
  }


  const requestCounts =
    new Map<
      string,
      {
        total: number;
        opened: number;
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
      requestCounts.get(
        request.quote_id,
      ) ??
      {
        total: 0,
        opened: 0,
      };


    current.total +=
      1;


    if (
      request.status ===
        "opened" ||
      request.status ===
        "responded" ||
      request.status ===
        "won" ||
      request.status ===
        "lost"
    ) {
      current.opened +=
        1;
    }


    requestCounts.set(
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
            O Orbiq cruza automaticamente as peças do orçamento com os fornecedores que atendem cada categoria.
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
              Escolha o atendimento
            </h2>
          </div>
        </div>


        {quotes.length ===
        0 ? (
          <div className="orbiq-empty">
            <strong>
              Nenhum orçamento.
            </strong>

            <span>
              Crie um orçamento para iniciar uma cotação.
            </span>

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


                const items =
                  itemCounts.get(
                    quote.id,
                  ) ??
                  0;


                const requests =
                  requestCounts.get(
                    quote.id,
                  ) ??
                  {
                    total: 0,
                    opened: 0,
                  };


                return (
                  <article
                    key={
                      quote.id
                    }
                    className="quote-center-row"
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
                          {items}
                        </b>

                        peças
                      </span>

                      <span>
                        <b>
                          {requests.opened}/
                          {requests.total}
                        </b>

                        enviados
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


                    {items >
                    0 ? (
                      <Link
                        href={
                          `/dashboard/cotacoes/${quote.id}`
                        }
                        className="orbiq-primary-button"
                      >
                        Cotar
                      </Link>
                    ) : (
                      <span className="quote-no-items">
                        Sem peças
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