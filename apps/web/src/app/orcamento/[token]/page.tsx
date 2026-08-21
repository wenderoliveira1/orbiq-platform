import {
  notFound,
} from "next/navigation";

import {
  createPublicSupabaseClient,
} from "../../../lib/supabase/public";

import {
  approvePublicQuoteAction,
  rejectPublicQuoteAction,
} from "./actions";


type PublicService = {
  id: string;
  category: string;
  description: string;
  amount: number;
};


type PublicItem = {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  side: string | null;
  specification: string | null;
  sale_unit_amount: number;
  sale_total_amount: number;
};


type PublicQuote = {
  protocol: string;
  organization_name: string;
  customer_name: string;
  plate: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  model_year: number | null;
  mileage: number | null;
  commercial_status: string;
  subtotal_amount: number;
  discount_amount: number;
  final_amount: number;
  created_at: string;
  expires_at: string;
  services: PublicService[];
  items: PublicItem[];
};


type PageProps = {

  params:
    Promise<{
      token:
        string;
    }>;

  searchParams:
    Promise<{
      ok?: string;
      error?: string;
    }>;
};


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
    },
  ).format(
    value,
  );
}


function quantity(
  value:
    number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      maximumFractionDigits:
        3,
    },
  ).format(
    value,
  );
}


function date(
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

      year:
        "numeric",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


function statusLabel(
  value:
    string,
): string {

  const labels:
    Record<string, string> = {

    ready:
      "Aguardando sua aprovação",

    approved:
      "Orçamento aprovado",

    rejected:
      "Orçamento não aprovado",
  };


  return (
    labels[
      value
    ] ??
    value
  );
}


export default async function PublicQuotePage({
  params,
  searchParams,
}: PageProps) {

  const {
    token,
  } =
    await params;


  const query =
    await searchParams;


  const supabase =
    createPublicSupabaseClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "public_get_quote",
      {
        target_token:
          token,
      },
    );


  if (
    error ||
    !data
  ) {

    notFound();
  }


  const quote =
    data as unknown as PublicQuote;


  const laborTotal =
    quote.services.reduce(
      (
        total,
        service,
      ) =>
        total +
        service.amount,
      0,
    );


  const partsTotal =
    quote.items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.sale_total_amount,
      0,
    );


  const canDecide =
    quote.commercial_status ===
    "ready";


  return (
    <main className="public-quote-shell">

      <article className="public-quote-card">

        <header className="public-quote-header">

          <div className="public-brand">

            <span>
              O
            </span>

            <div>

              <strong>
                ORBIQ
              </strong>

              <small>
                {quote.organization_name}
              </small>

            </div>

          </div>


          <div className="public-protocol">

            <span>
              ORÇAMENTO
            </span>

            <strong>
              {quote.protocol}
            </strong>

            <small>
              {date(
                quote.created_at,
              )}
            </small>

          </div>

        </header>


        {query.ok ? (

          <div className="public-alert success">
            {query.ok}
          </div>

        ) : null}


        {query.error ? (

          <div className="public-alert error">
            {query.error}
          </div>

        ) : null}


        <section className="public-hero">

          <div>

            <span>
              ORÇAMENTO AUTOMOTIVO
            </span>

            <h1>
              Olá,{" "}
              {quote.customer_name
                .trim()
                .split(/\s+/)[0]}
            </h1>

            <p>
              Confira abaixo os serviços e peças preparados para o seu veículo.
            </p>

          </div>


          <span
            className={
              `public-status status-${quote.commercial_status}`
            }
          >
            {statusLabel(
              quote.commercial_status,
            )}
          </span>

        </section>


        <section className="public-vehicle">

          <div>

            <span>
              VEÍCULO
            </span>

            <strong>
              {quote.plate}
            </strong>

          </div>


          <div>

            <span>
              MODELO
            </span>

            <strong>
              {[
                quote.brand,
                quote.model,
                quote.version,
              ]
                .filter(Boolean)
                .join(" ") ||
                "Não informado"}
            </strong>

          </div>


          <div>

            <span>
              ANO / KM
            </span>

            <strong>
              {quote.model_year ??
                "—"}

              {quote.mileage !==
              null
                ? ` · ${quantity(
                    quote.mileage,
                  )} km`
                : ""}
            </strong>

          </div>

        </section>


        <section className="public-section">

          <div className="public-section-heading">

            <div>

              <span>
                SERVIÇOS
              </span>

              <h2>
                Mão de obra
              </h2>

            </div>


            <strong>
              {money(
                laborTotal,
              )}
            </strong>

          </div>


          <div className="public-list">

            {quote.services.map(
              (
                service,
                index,
              ) => (

                <div
                  key={
                    service.id
                  }
                  className="public-service-row"
                >

                  <span>
                    {String(
                      index +
                      1,
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
                      service.amount,
                    )}
                  </strong>

                </div>

              ),
            )}

          </div>

        </section>


        {quote.items.length >
        0 ? (

          <section className="public-section">

            <div className="public-section-heading">

              <div>

                <span>
                  PEÇAS
                </span>

                <h2>
                  Materiais
                </h2>

              </div>


              <strong>
                {money(
                  partsTotal,
                )}
              </strong>

            </div>


            <div className="public-list">

              {quote.items.map(
                (
                  item,
                  index,
                ) => (

                  <div
                    key={
                      item.id
                    }
                    className="public-part-row"
                  >

                    <span>
                      {String(
                        index +
                        1,
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
                          `${quantity(
                            item.quantity,
                          )} ${item.unit}`,
                          item.side,
                          item.specification,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>

                    </div>


                    <div>

                      <small>
                        Unitário
                      </small>

                      <strong>
                        {money(
                          item.sale_unit_amount,
                        )}
                      </strong>

                    </div>


                    <strong>
                      {money(
                        item.sale_total_amount,
                      )}
                    </strong>

                  </div>

                ),
              )}

            </div>

          </section>

        ) : null}


        <section className="public-totals">

          <div>

            <span>
              Mão de obra
            </span>

            <strong>
              {money(
                laborTotal,
              )}
            </strong>

          </div>


          <div>

            <span>
              Peças
            </span>

            <strong>
              {money(
                partsTotal,
              )}
            </strong>

          </div>


          <div>

            <span>
              Subtotal
            </span>

            <strong>
              {money(
                quote.subtotal_amount,
              )}
            </strong>

          </div>


          {quote.discount_amount >
          0 ? (

            <div className="public-discount">

              <span>
                Desconto
              </span>

              <strong>
                - {money(
                  quote.discount_amount,
                )}
              </strong>

            </div>

          ) : null}


          <div className="public-grand-total">

            <span>
              VALOR TOTAL
            </span>

            <strong>
              {money(
                quote.final_amount,
              )}
            </strong>

          </div>

        </section>


        {canDecide ? (

          <section className="public-decision">

            <div>

              <span>
                SUA DECISÃO
              </span>

              <h2>
                Deseja aprovar este orçamento?
              </h2>

              <p>
                A decisão será registrada diretamente na oficina.
              </p>

            </div>


            <div className="public-decision-actions">

              <form
                action={
                  approvePublicQuoteAction
                }
              >

                <input
                  type="hidden"
                  name="token"
                  value={
                    token
                  }
                />


                <button
                  type="submit"
                  className="public-approve"
                >
                  ✓ Aprovar orçamento
                </button>

              </form>


              <details className="public-reject">

                <summary>
                  Não aprovar
                </summary>


                <form
                  action={
                    rejectPublicQuoteAction
                  }
                >

                  <input
                    type="hidden"
                    name="token"
                    value={
                      token
                    }
                  />


                  <textarea
                    name="reason"
                    rows={3}
                    placeholder="Se quiser, conte o motivo."
                  />


                  <button
                    type="submit"
                  >
                    Confirmar que não aprovo
                  </button>

                </form>

              </details>

            </div>

          </section>

        ) : (

          <section
            className={
              `public-decision-complete complete-${quote.commercial_status}`
            }
          >

            <strong>
              {quote.commercial_status ===
              "approved"
                ? "✓ Orçamento aprovado"
                : "Orçamento não aprovado"}
            </strong>

            <span>
              Sua decisão já foi registrada na oficina.
            </span>

          </section>

        )}


        <footer className="public-footer">

          <strong>
            {quote.organization_name}
          </strong>

          <span>
            Link válido até{" "}
            {date(
              quote.expires_at,
            )}
          </span>

          <small>
            Powered by Orbiq
          </small>

        </footer>

      </article>

    </main>
  );
}