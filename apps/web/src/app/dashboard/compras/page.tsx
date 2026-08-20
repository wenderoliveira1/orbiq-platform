import Link from "next/link";

import {
  getCurrentContext,
} from "../_lib/current-organization";

import {
  syncPurchaseOrdersAction,
} from "./actions";


type SearchParams =
  Promise<{
    ok?: string;
    error?: string;
  }>;


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


function formatDate(
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


export default async function PurchasesPage({
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
    quoteItemsResult,
    ordersResult,
    orderItemsResult,
    suppliersResult,
  ] =
    await Promise.all([

      supabase
        .from("quotes")
        .select(
          "id, protocol, customer_id, vehicle_id, status, created_at",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "status",
          [
            "awaiting_parts",
            "in_progress",
          ],
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
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
          "id, quote_id, supplier_id, chosen_amount",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from("purchase_orders")
        .select(
          "id, quote_id, supplier_id, code, status, total_amount, ordered_at, received_at, created_at",
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
        .from("purchase_order_items")
        .select(
          "id, order_id, status",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from("suppliers")
        .select(
          "id, name",
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
      quoteItemsResult,
      ordersResult,
      orderItemsResult,
      suppliersResult,
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


  const quotes =
    quotesResult.data ??
    [];


  const orders =
    ordersResult.data ??
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


  const suppliers =
    new Map(
      (
        suppliersResult.data ??
        []
      ).map(
        (supplier) =>
          [
            supplier.id,
            supplier,
          ] as const,
      ),
    );


  const selectedSuppliersByQuote =
    new Map<
      string,
      Set<string>
    >();


  for (
    const item
    of quoteItemsResult.data ??
    []
  ) {

    if (
      !item.supplier_id ||
      item.chosen_amount ===
        null
    ) {

      continue;
    }


    const current =
      selectedSuppliersByQuote.get(
        item.quote_id,
      ) ??
      new Set<string>();


    current.add(
      item.supplier_id,
    );


    selectedSuppliersByQuote.set(
      item.quote_id,
      current,
    );
  }


  const orderCountByQuote =
    new Map<
      string,
      number
    >();


  for (
    const order
    of orders
  ) {

    orderCountByQuote.set(
      order.quote_id,
      (
        orderCountByQuote.get(
          order.quote_id,
        ) ??
        0
      ) +
      1,
    );
  }


  const progressByOrder =
    new Map<
      string,
      {
        total:
          number;

        received:
          number;
      }
    >();


  for (
    const item
    of orderItemsResult.data ??
    []
  ) {

    const current =
      progressByOrder.get(
        item.order_id,
      ) ??
      {
        total:
          0,

        received:
          0,
      };


    current.total +=
      1;


    if (
      item.status ===
      "received"
    ) {

      current.received +=
        1;
    }


    progressByOrder.set(
      item.order_id,
      current,
    );
  }


  const awaiting =
    orders.filter(
      (order) =>
        order.status ===
        "approved",
    ).length;


  const ordered =
    orders.filter(
      (order) =>
        order.status ===
          "ordered" ||
        order.status ===
          "partially_received",
    ).length;


  const received =
    orders.filter(
      (order) =>
        order.status ===
        "received",
    ).length;


  const totalOpen =
    orders
      .filter(
        (order) =>
          order.status !==
          "received",
      )
      .reduce(
        (
          total,
          order,
        ) =>
          total +
          order.total_amount,
        0,
      );


  const quotesNeedingSync =
    quotes.filter(
      (quote) => {

        if (
          quote.status !==
          "awaiting_parts"
        ) {

          return false;
        }


        const supplierCount =
          selectedSuppliersByQuote.get(
            quote.id,
          )?.size ??
          0;


        const currentOrders =
          orderCountByQuote.get(
            quote.id,
          ) ??
          0;


        return (
          supplierCount >
          currentOrders
        );
      },
    );


  return (
    <div className="orbiq-page">

      <section className="orbiq-page-heading">

        <div>

          <span className="orbiq-eyebrow">
            COMPRAS
          </span>

          <h1>
            Pedidos e recebimento
          </h1>

          <p>
            Acompanhe cada compra desde a aprovação até a chegada das peças na oficina.
          </p>

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


      <section className="purchase-metrics">

        <article>

          <span>
            Aguardando pedido
          </span>

          <strong>
            {awaiting}
          </strong>

        </article>


        <article>

          <span>
            Em trânsito / pendentes
          </span>

          <strong>
            {ordered}
          </strong>

        </article>


        <article>

          <span>
            Recebidos
          </span>

          <strong>
            {received}
          </strong>

        </article>


        <article>

          <span>
            Valor em aberto
          </span>

          <strong>
            {currency(
              totalOpen,
            )}
          </strong>

        </article>

      </section>


      {quotesNeedingSync.length >
      0 ? (

        <section className="orbiq-panel purchase-sync-panel">

          <div className="orbiq-panel-heading">

            <div>

              <span className="orbiq-eyebrow">
                COMPRAS APROVADAS
              </span>

              <h2>
                Gerar pedidos
              </h2>

            </div>

            <span className="orbiq-count-badge">
              {quotesNeedingSync.length}
            </span>

          </div>


          <div className="purchase-sync-list">

            {quotesNeedingSync.map(
              (quote) => {

                const customer =
                  customers.get(
                    quote.customer_id,
                  );


                const vehicle =
                  vehicles.get(
                    quote.vehicle_id,
                  );


                const suppliersCount =
                  selectedSuppliersByQuote.get(
                    quote.id,
                  )?.size ??
                  0;


                return (
                  <article
                    key={
                      quote.id
                    }
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


                    <span>
                      {suppliersCount} fornecedor(es)
                    </span>


                    <form
                      action={
                        syncPurchaseOrdersAction
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
                        Gerar pedidos
                      </button>

                    </form>

                  </article>
                );
              },
            )}

          </div>

        </section>

      ) : null}


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              PEDIDOS
            </span>

            <h2>
              Compras da oficina
            </h2>

          </div>

          <span className="orbiq-count-badge">
            {orders.length}
          </span>

        </div>


        {orders.length ===
        0 ? (

          <div className="orbiq-empty">

            <strong>
              Nenhum pedido criado.
            </strong>

            <span>
              Aprove uma cotação e gere os pedidos dos fornecedores vencedores.
            </span>

            <Link
              href="/dashboard/cotacoes"
              className="orbiq-primary-button"
            >
              Ir para cotações
            </Link>

          </div>

        ) : (

          <div className="purchase-order-list">

            {orders.map(
              (order) => {

                const quote =
                  quotes.find(
                    (item) =>
                      item.id ===
                      order.quote_id,
                  );


                const supplier =
                  suppliers.get(
                    order.supplier_id,
                  );


                const progress =
                  progressByOrder.get(
                    order.id,
                  ) ??
                  {
                    total:
                      0,

                    received:
                      0,
                  };


                const percent =
                  progress.total >
                  0
                    ? Math.round(
                        (
                          progress.received /
                          progress.total
                        ) *
                          100,
                      )
                    : 0;


                return (
                  <Link
                    key={
                      order.id
                    }
                    href={
                      `/dashboard/compras/${order.id}`
                    }
                    className="purchase-order-row"
                  >

                    <div className="purchase-order-code">

                      <strong>
                        {order.code}
                      </strong>

                      <span>
                        {formatDate(
                          order.created_at,
                        )}
                      </span>

                    </div>


                    <div>

                      <strong>
                        {supplier?.name ??
                          "Fornecedor"}
                      </strong>

                      <span>
                        {quote?.protocol ??
                          "Orçamento"}
                      </span>

                    </div>


                    <div className="purchase-progress">

                      <div>

                        <span
                          style={{
                            width:
                              `${percent}%`,
                          }}
                        />

                      </div>

                      <small>
                        {progress.received}/
                        {progress.total} recebido(s)
                      </small>

                    </div>


                    <strong className="purchase-order-total">
                      {currency(
                        order.total_amount,
                      )}
                    </strong>


                    <span
                      className={
                        `purchase-status purchase-${order.status}`
                      }
                    >
                      {orderStatusLabel(
                        order.status,
                      )}
                    </span>


                    <strong className="purchase-arrow">
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