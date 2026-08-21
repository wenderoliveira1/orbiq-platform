import {
  notFound,
} from "next/navigation";

import {
  getCurrentContext,
} from "../../../_lib/current-organization";

import {
  CustomerQuoteToolbar,
} from "./customer-quote-toolbar";


type PageProps = {
  params:
    Promise<{
      quoteId: string;
    }>;
};


function money(
  value: number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  ).format(value);
}


function number(
  value: number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      maximumFractionDigits: 3,
    },
  ).format(value);
}


function date(
  raw: string,
): string {

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(
    new Date(raw),
  );
}


function statusLabel(
  status: string,
): string {

  const labels:
    Record<string, string> = {
      draft: "Em elaboração",
      ready: "Aguardando aprovação",
      approved: "Aprovado",
      rejected: "Reprovado",
    };


  return labels[status] ?? status;
}


export default async function CustomerQuotePage({
  params,
}: PageProps) {

  const {
    quoteId,
  } =
    await params;


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    data: quote,
    error: quoteError,
  } =
    await supabase
      .from("quotes")
      .select(
        "id, protocol, customer_id, vehicle_id, mileage, commercial_status, subtotal_amount, discount_amount, final_amount, created_at",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        quoteId,
      )
      .maybeSingle();


  if (quoteError) {
    throw new Error(
      quoteError.message,
    );
  }


  if (!quote) {
    notFound();
  }


  const [
    customerResult,
    vehicleResult,
    servicesResult,
    itemsResult,
  ] =
    await Promise.all([

      supabase
        .from("customers")
        .select(
          "id, name, phone, email",
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
        .from("quote_services")
        .select(
          "id, category, description, labor_amount",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "quote_id",
          quote.id,
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        ),

      supabase
        .from("quote_items")
        .select(
          "id, category, description, quantity, unit, side, specification, sale_unit_amount, sale_total_amount",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "quote_id",
          quote.id,
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        ),
    ]);


  for (
    const result of [
      customerResult,
      vehicleResult,
      servicesResult,
      itemsResult,
    ]
  ) {

    if (result.error) {
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
    servicesResult.data ?? [];


  const items =
    itemsResult.data ?? [];


  const laborTotal =
    services.reduce(
      (
        total,
        service,
      ) =>
        total +
        (
          service.labor_amount ??
          0
        ),
      0,
    );


  const partsTotal =
    items.reduce(
      (
        total,
        item,
      ) =>
        total +
        (
          item.sale_total_amount ??
          0
        ),
      0,
    );


  const subtotal =
    quote.subtotal_amount ??
    (
      laborTotal +
      partsTotal
    );


  const discount =
    quote.discount_amount ??
    0;


  const finalAmount =
    quote.final_amount ??
    (
      subtotal -
      discount
    );


  const readyForCustomer =
    quote.commercial_status !== "draft" &&
    quote.final_amount !== null;


  if (!readyForCustomer) {

    return (
      <div className="customer-quote-page">

        <CustomerQuoteToolbar
          quoteId={quote.id}
          protocol={quote.protocol}
          workshopName={organization.name}
          customerName={
            customer?.name ??
            "Cliente"
          }
          customerPhone={
            customer?.phone ??
            null
          }
          vehiclePlate={
            vehicle?.plate ??
            "Veículo"
          }
          totalFormatted={money(0)}
        />


        <section className="customer-quote-not-ready">

          <span>
            ORÇAMENTO COMERCIAL
          </span>

          <h1>
            Orçamento ainda não está pronto.
          </h1>

          <p>
            Defina os preços de venda e salve o orçamento comercial antes de gerar a versão do cliente.
          </p>

        </section>

      </div>
    );
  }


  return (
    <div className="customer-quote-page">

      <CustomerQuoteToolbar
        quoteId={quote.id}
        protocol={quote.protocol}
        workshopName={organization.name}
        customerName={
          customer?.name ??
          "Cliente"
        }
        customerPhone={
          customer?.phone ??
          null
        }
        vehiclePlate={
          vehicle?.plate ??
          "Veículo"
        }
        totalFormatted={
          money(finalAmount)
        }
      />


      <article className="customer-quote-document">

        <header className="customer-quote-header">

          <div className="customer-quote-brand">

            <span>
              O
            </span>

            <div>

              <strong>
                ORBIQ
              </strong>

              <small>
                {organization.name}
              </small>

            </div>

          </div>


          <div className="customer-quote-number">

            <span>
              ORÇAMENTO
            </span>

            <strong>
              {quote.protocol}
            </strong>

            <small>
              Emitido em {date(
                quote.created_at,
              )}
            </small>

          </div>

        </header>


        <section className="customer-quote-title">

          <div>

            <span>
              ORÇAMENTO AUTOMOTIVO
            </span>

            <h1>
              Serviços e peças
            </h1>

            <p>
              Proposta preparada especialmente para este veículo.
            </p>

          </div>


          <span
            className={
              `customer-quote-status customer-status-${quote.commercial_status}`
            }
          >
            {statusLabel(
              quote.commercial_status,
            )}
          </span>

        </section>


        <section className="customer-quote-info-grid">

          <div>

            <span className="customer-section-label">
              CLIENTE
            </span>

            <strong>
              {customer?.name ??
                "Cliente"}
            </strong>


            {customer?.phone ? (
              <small>
                {customer.phone}
              </small>
            ) : null}


            {customer?.email ? (
              <small>
                {customer.email}
              </small>
            ) : null}

          </div>


          <div>

            <span className="customer-section-label">
              VEÍCULO
            </span>

            <strong>
              {vehicle?.plate ??
                "—"}
            </strong>

            <small>
              {[
                vehicle?.brand,
                vehicle?.model,
                vehicle?.version,
              ]
                .filter(Boolean)
                .join(" ") ||
                "Veículo"}
            </small>

            <small>
              {vehicle?.model_year
                ? `Ano ${vehicle.model_year}`
                : ""}

              {quote.mileage !== null
                ? `${vehicle?.model_year ? " · " : ""}${number(
                    quote.mileage,
                  )} km`
                : ""}
            </small>

          </div>

        </section>


        <section className="customer-quote-section">

          <div className="customer-quote-section-heading">

            <div>

              <span className="customer-section-label">
                SERVIÇOS
              </span>

              <h2>
                Mão de obra
              </h2>

            </div>


            <strong>
              {money(laborTotal)}
            </strong>

          </div>


          <div className="customer-service-table">

            {services.map(
              (
                service,
                index,
              ) => (

                <div
                  key={service.id}
                  className="customer-service-row"
                >

                  <span>
                    {String(
                      index + 1,
                    ).padStart(
                      2,
                      "0",
                    )}
                  </span>


                  <div>

                    <strong>
                      {service.description}
                    </strong>

                    <small>
                      {service.category}
                    </small>

                  </div>


                  <strong>
                    {money(
                      service.labor_amount ??
                      0,
                    )}
                  </strong>

                </div>

              ),
            )}

          </div>

        </section>


        {items.length > 0 ? (

          <section className="customer-quote-section">

            <div className="customer-quote-section-heading">

              <div>

                <span className="customer-section-label">
                  PEÇAS
                </span>

                <h2>
                  Materiais
                </h2>

              </div>


              <strong>
                {money(partsTotal)}
              </strong>

            </div>


            <div className="customer-parts-table">

              <div className="customer-parts-head">

                <span>
                  Item
                </span>

                <span>
                  Qtd.
                </span>

                <span>
                  Unitário
                </span>

                <span>
                  Total
                </span>

              </div>


              {items.map(
                (
                  item,
                  index,
                ) => (

                  <div
                    key={item.id}
                    className="customer-part-row"
                  >

                    <div>

                      <span className="customer-part-number">
                        {String(
                          index + 1,
                        ).padStart(
                          2,
                          "0",
                        )}
                      </span>


                      <div>

                        <strong>
                          {item.description}
                        </strong>

                        <small>
                          {[
                            item.category,
                            item.side,
                            item.specification,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>

                      </div>

                    </div>


                    <span>
                      {number(
                        item.quantity,
                      )}{" "}
                      {item.unit}
                    </span>


                    <strong>
                      {money(
                        item.sale_unit_amount ??
                        0,
                      )}
                    </strong>


                    <strong>
                      {money(
                        item.sale_total_amount ??
                        0,
                      )}
                    </strong>

                  </div>

                ),
              )}

            </div>

          </section>

        ) : null}


        <section className="customer-quote-totals">

          <div>

            <span>
              Mão de obra
            </span>

            <strong>
              {money(laborTotal)}
            </strong>

          </div>


          <div>

            <span>
              Peças
            </span>

            <strong>
              {money(partsTotal)}
            </strong>

          </div>


          <div>

            <span>
              Subtotal
            </span>

            <strong>
              {money(subtotal)}
            </strong>

          </div>


          {discount > 0 ? (

            <div className="customer-quote-discount">

              <span>
                Desconto
              </span>

              <strong>
                - {money(discount)}
              </strong>

            </div>

          ) : null}


          <div className="customer-quote-grand-total">

            <span>
              TOTAL
            </span>

            <strong>
              {money(finalAmount)}
            </strong>

          </div>

        </section>


        <footer className="customer-quote-footer">

          <div>

            <strong>
              {organization.name}
            </strong>

            <span>
              Orçamento {quote.protocol}
            </span>

          </div>


          <p>
            Valores sujeitos à disponibilidade das peças e à confirmação dos serviços pela oficina.
          </p>

        </footer>

      </article>

    </div>
  );
}