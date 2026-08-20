import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  getCurrentContext,
} from "../../_lib/current-organization";

import {
  markOrderOrderedAction,
  receiveAllAction,
  receiveItemAction,
} from "./actions";


type PageProps = {

  params:
    Promise<{
      orderId:
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


function orderStatusLabel(
  status:
    string,
): string {

  const labels:
    Record<string, string> = {

    approved:
      "Aprovado",

    ordered:
      "Pedido realizado",

    partially_received:
      "Recebimento parcial",

    received:
      "Recebido",

    cancelled:
      "Cancelado",
  };


  return (
    labels[
      status
    ] ??
    status
  );
}


export default async function PurchaseOrderPage({
  params,
  searchParams,
}: PageProps) {

  const {
    orderId,
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
    data: order,
    error: orderError,
  } =
    await supabase
      .from("purchase_orders")
      .select(
        "id, quote_id, supplier_id, code, status, total_amount, ordered_at, received_at, notes, created_at",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        orderId,
      )
      .maybeSingle();


  if (
    orderError
  ) {

    throw new Error(
      `Falha ao carregar pedido: ${orderError.message}`,
    );
  }


  if (!order) {

    notFound();
  }


  const [
    quoteResult,
    supplierResult,
    itemsResult,
  ] =
    await Promise.all([

      supabase
        .from("quotes")
        .select(
          "id, protocol, customer_id, vehicle_id, status",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "id",
          order.quote_id,
        )
        .maybeSingle(),

      supabase
        .from("suppliers")
        .select(
          "id, name, whatsapp, notes",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "id",
          order.supplier_id,
        )
        .maybeSingle(),

      supabase
        .from("purchase_order_items")
        .select(
          "id, quote_item_id, category, description, quantity, unit, side, specification, unit_amount, total_amount, status, received_quantity, received_at",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "order_id",
          order.id,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),
    ]);


  for (
    const result
    of [
      quoteResult,
      supplierResult,
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


  const quote =
    quoteResult.data;


  const supplier =
    supplierResult.data;


  if (!quote) {

    throw new Error(
      "Orçamento do pedido não encontrado.",
    );
  }


  const [
    customerResult,
    vehicleResult,
  ] =
    await Promise.all([

      supabase
        .from("customers")
        .select(
          "id, name",
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
          "id, plate, brand, model, version",
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
    ]);


  if (
    customerResult.error
  ) {

    throw new Error(
      customerResult.error.message,
    );
  }


  if (
    vehicleResult.error
  ) {

    throw new Error(
      vehicleResult.error.message,
    );
  }


  const customer =
    customerResult.data;


  const vehicle =
    vehicleResult.data;


  const items =
    itemsResult.data ??
    [];


  const receivedItems =
    items.filter(
      (item) =>
        item.status ===
        "received",
    ).length;


  const progress =
    items.length >
    0
      ? Math.round(
          (
            receivedItems /
            items.length
          ) *
            100,
        )
      : 0;


  const whatsapp =
    String(
      supplier?.whatsapp ??
        "",
    ).replace(
      /\D/g,
      "",
    );


  const validWhatsapp =
    whatsapp.length >=
      10 &&
    whatsapp.length <=
      15;


  const canReceive =
    order.status !==
      "received" &&
    order.status !==
      "cancelled";


  return (
    <div className="orbiq-page">

      <section className="purchase-detail-heading">

        <div>

          <Link
            href="/dashboard/compras"
            className="quote-back-link"
          >
            ← Compras
          </Link>

          <span className="orbiq-eyebrow">
            PEDIDO DE COMPRA
          </span>

          <h1>
            {order.code}
          </h1>

          <p>
            {supplier?.name ??
              "Fornecedor"}{" · "}

            {quote.protocol}
          </p>

        </div>


        <div className="purchase-detail-actions">

          <span
            className={
              `purchase-status purchase-${order.status}`
            }
          >
            {orderStatusLabel(
              order.status,
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


      {order.status ===
      "received" ? (

        <section className="purchase-release-banner">

          <div>

            <span className="orbiq-eyebrow">
              PEDIDO RECEBIDO
            </span>

            <strong>
              Todas as peças deste fornecedor chegaram.
            </strong>

            <span>
              Se este era o último pedido pendente, o Orbiq já liberou automaticamente o orçamento para execução.
            </span>

          </div>

        </section>

      ) : null}


      <section className="purchase-detail-grid">

        <article className="orbiq-panel">

          <span className="orbiq-eyebrow">
            FORNECEDOR
          </span>

          <h2>
            {supplier?.name ??
              "Fornecedor"}
          </h2>

          <div className="quote-detail-info">

            <span>
              WhatsApp
            </span>

            <strong>
              {validWhatsapp
                ? `+${whatsapp}`
                : "Não cadastrado"}
            </strong>


            <span>
              Valor do pedido
            </span>

            <strong>
              {currency(
                order.total_amount,
              )}
            </strong>

          </div>

        </article>


        <article className="orbiq-panel">

          <span className="orbiq-eyebrow">
            VEÍCULO
          </span>

          <div className="purchase-vehicle-title">

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
              Cliente
            </span>

            <strong>
              {customer?.name ??
                "—"}
            </strong>


            <span>
              Protocolo
            </span>

            <strong>
              {quote.protocol}
            </strong>

          </div>

        </article>

      </section>


      <section className="purchase-order-flow">

        <div
          className={
            order.status !==
            "cancelled"
              ? "done"
              : ""
          }
        >

          <b>
            1
          </b>

          <span>
            Compra aprovada
          </span>

        </div>


        <i>
          →
        </i>


        <div
          className={
            [
              "ordered",
              "partially_received",
              "received",
            ].includes(
              order.status,
            )
              ? "done"
              : ""
          }
        >

          <b>
            2
          </b>

          <span>
            Pedido realizado
          </span>

        </div>


        <i>
          →
        </i>


        <div
          className={
            [
              "partially_received",
              "received",
            ].includes(
              order.status,
            )
              ? "done"
              : ""
          }
        >

          <b>
            3
          </b>

          <span>
            Recebimento
          </span>

        </div>


        <i>
          →
        </i>


        <div
          className={
            order.status ===
            "received"
              ? "done"
              : ""
          }
        >

          <b>
            4
          </b>

          <span>
            Concluído
          </span>

        </div>

      </section>


      {order.status ===
      "approved" ? (

        <section className="orbiq-panel purchase-confirm-panel">

          <div>

            <span className="orbiq-eyebrow">
              CONFIRMAR PEDIDO
            </span>

            <h2>
              Pedido pronto para envio
            </h2>

            <p>
              Confirme a compra com o fornecedor. O Orbiq não envia dados do cliente nessa mensagem.
            </p>

          </div>


          <div className="purchase-confirm-actions">

            {validWhatsapp ? (

              <a
                href={
                  `/dashboard/compras/abrir/${order.id}`
                }
                target="_blank"
                rel="noreferrer"
                className="orbiq-primary-button"
              >
                Confirmar no WhatsApp
              </a>

            ) : null}


            <form
              action={
                markOrderOrderedAction
              }
            >

              <input
                type="hidden"
                name="order_id"
                value={
                  order.id
                }
              />

              <input
                type="hidden"
                name="quote_id"
                value={
                  quote.id
                }
              />

              <button
                type="submit"
                className="orbiq-secondary-button"
              >
                Marcar como pedido
              </button>

            </form>

          </div>

        </section>

      ) : null}


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              RECEBIMENTO
            </span>

            <h2>
              Peças do pedido
            </h2>

          </div>


          <div className="purchase-progress-counter">

            <strong>
              {receivedItems}/
              {items.length}
            </strong>

            <span>
              recebidas
            </span>

          </div>

        </div>


        <div className="purchase-big-progress">

          <span
            style={{
              width:
                `${progress}%`,
            }}
          />

        </div>


        <div className="purchase-detail-items">

          {items.map(
            (item) => {

              const received =
                item.status ===
                "received";


              return (
                <article
                  key={
                    item.id
                  }
                  className={
                    received
                      ? "received"
                      : ""
                  }
                >

                  <div className="purchase-item-check">

                    {received
                      ? "✓"
                      : ""}

                  </div>


                  <div className="purchase-item-description">

                    <strong>
                      {item.description}
                    </strong>

                    <span>
                      {item.category}
                    </span>

                    <small>
                      {[
                        item.side,
                        item.specification,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>

                  </div>


                  <div>

                    <span>
                      Quantidade
                    </span>

                    <strong>
                      {quantity(
                        item.quantity,
                      )}{" "}
                      {item.unit}
                    </strong>

                  </div>


                  <div>

                    <span>
                      Unitário
                    </span>

                    <strong>
                      {currency(
                        item.unit_amount,
                      )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      Total
                    </span>

                    <strong>
                      {currency(
                        item.total_amount,
                      )}
                    </strong>

                  </div>


                  <div>

                    {received ? (

                      <span className="purchase-item-received">
                        Recebido
                      </span>

                    ) : canReceive ? (

                      <form
                        action={
                          receiveItemAction
                        }
                      >

                        <input
                          type="hidden"
                          name="order_id"
                          value={
                            order.id
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
                          name="item_id"
                          value={
                            item.id
                          }
                        />

                        <button
                          type="submit"
                          className="orbiq-secondary-button"
                        >
                          Receber
                        </button>

                      </form>

                    ) : null}

                  </div>

                </article>
              );
            },
          )}

        </div>


        {canReceive &&
        items.some(
          (item) =>
            item.status !==
            "received",
        ) ? (

          <div className="purchase-receive-all">

            <div>

              <strong>
                O pedido chegou completo?
              </strong>

              <span>
                Marque todos os itens como recebidos de uma só vez.
              </span>

            </div>


            <form
              action={
                receiveAllAction
              }
            >

              <input
                type="hidden"
                name="order_id"
                value={
                  order.id
                }
              />

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
                Receber pedido inteiro
              </button>

            </form>

          </div>

        ) : null}

      </section>


      <section className="purchase-meta-grid">

        <div>

          <span>
            Criado
          </span>

          <strong>
            {dateTime(
              order.created_at,
            )}
          </strong>

        </div>


        <div>

          <span>
            Pedido realizado
          </span>

          <strong>
            {dateTime(
              order.ordered_at,
            )}
          </strong>

        </div>


        <div>

          <span>
            Recebido
          </span>

          <strong>
            {dateTime(
              order.received_at,
            )}
          </strong>

        </div>

      </section>

    </div>
  );
}