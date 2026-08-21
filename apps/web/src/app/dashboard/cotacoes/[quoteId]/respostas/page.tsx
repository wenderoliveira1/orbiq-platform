import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  getCurrentContext,
} from "../../../_lib/current-organization";

import {
  statusLabel,
} from "../../../orcamentos/quote-meta";

import {
  chooseSupplierForItemAction,
  finalizePurchasesAction,
  saveSupplierResponseAction,
} from "./actions";


type PageProps = {
  params:
    Promise<{
      quoteId:
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
    number |
    null,
): string {
  if (
    value === null
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


function requestStatus(
  value:
    string,
): string {
  const labels:
    Record<string, string> = {
      prepared:
        "Aguardando envio",

      opened:
        "WhatsApp aberto",

      responded:
        "Respondida",

      won:
        "Fornecedor escolhido",

      lost:
        "Não escolhido",

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


export default async function SupplierResponsesPage({
  params,
  searchParams,
}: PageProps) {
  const {
    quoteId,
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
    data: quote,
    error: quoteError,
  } =
    await supabase
      .from("quotes")
      .select(
        "id, protocol, customer_id, vehicle_id, status, created_at",
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


  if (
    quoteError
  ) {
    throw new Error(
      `Falha ao carregar orçamento: ${quoteError.message}`,
    );
  }


  if (!quote) {
    notFound();
  }


  const [
    customerResult,
    vehicleResult,
    itemsResult,
    requestsResult,
    suppliersResult,
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

      supabase
        .from("quote_items")
        .select(
          "id, category, description, quantity, unit, side, specification, purchase_status, supplier_id, chosen_amount",
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
            ascending:
              true,
          },
        ),

      supabase
        .from("quote_supplier_requests")
        .select(
          "id, supplier_id, status, response_amount, response_delivery, response_notes, responded_at, winner, created_at",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "quote_id",
          quote.id,
        )
        .neq(
          "status",
          "cancelled",
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from("suppliers")
        .select(
          "id, name, whatsapp, active",
        )
        .eq(
          "organization_id",
          organization.id,
        ),
    ]);


  for (
    const result
    of [
      customerResult,
      vehicleResult,
      itemsResult,
      requestsResult,
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


  const customer =
    customerResult.data;


  const vehicle =
    vehicleResult.data;


  const items =
    itemsResult.data ??
    [];


  const requests =
    requestsResult.data ??
    [];


  const suppliers =
    suppliersResult.data ??
    [];


  const supplierMap =
    new Map(
      suppliers.map(
        (supplier) =>
          [
            supplier.id,
            supplier,
          ] as const,
      ),
    );


  const itemMap =
    new Map(
      items.map(
        (item) =>
          [
            item.id,
            item,
          ] as const,
      ),
    );


  const requestIds =
    requests.map(
      (request) =>
        request.id,
    );


  let requestItems:
    Array<{
      request_id:
        string;

      quote_item_id:
        string;
    }> =
    [];


  let responses:
    Array<{
      id:
        string;

      request_id:
        string;

      quote_item_id:
        string;

      brand_option:
        string | null;

      unit_price:
        number;

      total_price:
        number;

      availability:
        string | null;

      delivery:
        string | null;

      notes:
        string | null;

      awarded:
        boolean;
    }> =
    [];


  if (
    requestIds.length >
    0
  ) {

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "quote_supplier_request_items",
        )
        .select(
          "request_id, quote_item_id",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "request_id",
          requestIds,
        );


    if (error) {

      throw new Error(
        `Falha ao carregar itens das cotações: ${error.message}`,
      );
    }


    requestItems =
      data ??
      [];


    const {
      data:
        responseData,

      error:
        responseError,
    } =
      await supabase
        .from(
          "quote_supplier_item_responses",
        )
        .select(
          "id, request_id, quote_item_id, brand_option, unit_price, total_price, availability, delivery, notes, awarded",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "request_id",
          requestIds,
        );


    if (
      responseError
    ) {

      throw new Error(
        `Falha ao carregar respostas: ${responseError.message}`,
      );
    }


    responses =
      responseData ??
      [];
  }


  const itemsByRequest =
    new Map<
      string,
      string[]
    >();


  for (
    const link
    of requestItems
  ) {

    const current =
      itemsByRequest.get(
        link.request_id,
      ) ??
      [];


    current.push(
      link.quote_item_id,
    );


    itemsByRequest.set(
      link.request_id,
      current,
    );
  }


  const responseMap =
    new Map(
      responses.map(
        (response) =>
          [
            `${response.request_id}||${response.quote_item_id}`,
            response,
          ] as const,
      ),
    );


  const responsesByItem =
    new Map<
      string,
      typeof responses
    >();


  for (
    const response
    of responses
  ) {

    const current =
      responsesByItem.get(
        response.quote_item_id,
      ) ??
      [];


    current.push(
      response,
    );


    responsesByItem.set(
      response.quote_item_id,
      current,
    );
  }


  const allItemsChosen =
    items.length >
      0 &&
    items.every(
      (item) =>
        Boolean(
          item.supplier_id,
        ) &&
        item.chosen_amount !==
          null,
    );


  const selectedTotal =
    items.reduce(
      (
        total,
        item,
      ) =>
        total +
        (
          item.chosen_amount ??
          0
        ),
      0,
    );


  const respondedRequests =
    requests.filter(
      (request) =>
        [
          "responded",
          "won",
          "lost",
        ].includes(
          request.status,
        ),
    ).length;


  return (
    <div className="orbiq-page">
      <section className="response-heading">
        <div>
          <Link
            href={
              `/dashboard/cotacoes/${quote.id}`
            }
            className="quote-back-link"
          >
            ← Voltar para envio
          </Link>

          <span className="orbiq-eyebrow">
            RESPOSTAS DAS COTAÇÕES
          </span>

          <h1>
            {quote.protocol}
          </h1>

          <p>
            {customer?.name ??
              "Cliente"}{" · "}

            {vehicle?.plate ??
              "Sem placa"}{" · "}

            {[
              vehicle?.brand,
              vehicle?.model,
              vehicle?.version,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>


        <div className="response-heading-actions">
          <span
            className={
              `quote-status status-${quote.status}`
            }
          >
            {statusLabel(
              quote.status,
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


      <section className="response-metrics">
        <article>
          <span>
            Fornecedores
          </span>

          <strong>
            {requests.length}
          </strong>
        </article>

        <article>
          <span>
            Responderam
          </span>

          <strong>
            {respondedRequests}
          </strong>
        </article>

        <article>
          <span>
            Peças
          </span>

          <strong>
            {items.length}
          </strong>
        </article>

        <article>
          <span>
            Selecionado
          </span>

          <strong>
            {currency(
              selectedTotal,
            )}
          </strong>
        </article>
      </section>


      {requests.length ===
      0 ? (
        <section className="orbiq-panel">
          <div className="orbiq-empty">
            <strong>
              Nenhuma cotação preparada.
            </strong>

            <span>
              Primeiro prepare os fornecedores que receberão a solicitação.
            </span>

            <Link
              href={
                `/dashboard/cotacoes/${quote.id}`
              }
              className="orbiq-primary-button"
            >
              Preparar cotações
            </Link>
          </div>
        </section>
      ) : (
        <section className="responses-layout">
          <div className="responses-column-title">
            <span className="orbiq-eyebrow">
              1 · RESPOSTAS
            </span>

            <h2>
              Registrar retorno dos fornecedores
            </h2>

            <p>
              Digite somente o que o fornecedor informou. O total é calculado automaticamente pela quantidade da peça.
            </p>
          </div>


          <div className="supplier-response-list">
            {requests.map(
              (request) => {
                const supplier =
                  supplierMap.get(
                    request.supplier_id,
                  );


                const linkedItemIds =
                  itemsByRequest.get(
                    request.id,
                  ) ??
                  [];


                const linkedItems =
                  linkedItemIds
                    .map(
                      (itemId) =>
                        itemMap.get(
                          itemId,
                        ),
                    )
                    .filter(
                      (
                        item,
                      ): item is NonNullable<
                        typeof item
                      > =>
                        Boolean(
                          item,
                        ),
                    );


                return (
                  <details
                    key={
                      request.id
                    }
                    className="supplier-response-card"
                    open={
                      request.status ===
                        "opened" ||
                      request.status ===
                        "prepared"
                    }
                  >
                    <summary>
                      <div>
                        <strong>
                          {supplier?.name ??
                            "Fornecedor"}
                        </strong>

                        <span>
                          {supplier?.whatsapp
                            ? "+" +
                              String(
                                supplier.whatsapp,
                              ).replace(
                                /\D/g,
                                "",
                              )
                            : "Sem WhatsApp"}
                        </span>
                      </div>


                      <div className="supplier-response-summary-meta">
                        <span
                          className={
                            `request-status request-${request.status}`
                          }
                        >
                          {requestStatus(
                            request.status,
                          )}
                        </span>

                        <strong>
                          {currency(
                            request.response_amount,
                          )}
                        </strong>
                      </div>
                    </summary>


                    <form
                      action={
                        saveSupplierResponseAction
                      }
                      className="supplier-response-form"
                    >
                      <input
                        type="hidden"
                        name="quote_id"
                        value={
                          quote.id
                        }
                      />

                      <input
                        type="hidden"
                        name="request_id"
                        value={
                          request.id
                        }
                      />


                      <div className="supplier-response-table">
                        <div className="supplier-response-head">
                          <span>
                            Peça
                          </span>

                          <span>
                            Marca / opção
                          </span>

                          <span>
                            Unitário
                          </span>

                          <span>
                            Disponibilidade
                          </span>

                          <span>
                            Prazo
                          </span>
                        </div>


                        {linkedItems.map(
                          (item) => {
                            const existing =
                              responseMap.get(
                                `${request.id}||${item.id}`,
                              );


                            return (
                              <div
                                key={
                                  item.id
                                }
                                className="supplier-response-row"
                              >
                                <div>
                                  <strong>
                                    {item.description}
                                  </strong>

                                  <span>
                                    {quantity(
                                      item.quantity,
                                    )}{" "}
                                    {item.unit}
                                  </span>

                                  <small>
                                    {item.side ??
                                      item.category}
                                  </small>
                                </div>


                                <input
                                  name={
                                    `brand__${item.id}`
                                  }
                                  defaultValue={
                                    existing?.brand_option ??
                                    ""
                                  }
                                  placeholder="Ex.: Axios"
                                />


                                <input
                                  name={
                                    `unit_price__${item.id}`
                                  }
                                  defaultValue={
                                    existing?.unit_price ??
                                    ""
                                  }
                                  inputMode="decimal"
                                  placeholder="0,00"
                                />


                                <input
                                  name={
                                    `availability__${item.id}`
                                  }
                                  defaultValue={
                                    existing?.availability ??
                                    ""
                                  }
                                  placeholder="Disponível"
                                />


                                <input
                                  name={
                                    `delivery__${item.id}`
                                  }
                                  defaultValue={
                                    existing?.delivery ??
                                    ""
                                  }
                                  placeholder="Hoje / 2 dias"
                                />


                                <input
                                  name={
                                    `notes__${item.id}`
                                  }
                                  defaultValue={
                                    existing?.notes ??
                                    ""
                                  }
                                  className="supplier-response-notes"
                                  placeholder="Observação do item"
                                />
                              </div>
                            );
                          },
                        )}
                      </div>


                      <div className="supplier-response-footer">
                        <label>
                          <span>
                            Prazo geral
                          </span>

                          <input
                            name="response_delivery"
                            defaultValue={
                              request.response_delivery ??
                              ""
                            }
                            placeholder="Ex.: entrega amanhã"
                          />
                        </label>


                        <label>
                          <span>
                            Observação geral
                          </span>

                          <input
                            name="response_notes"
                            defaultValue={
                              request.response_notes ??
                              ""
                            }
                            placeholder="Ex.: preço para pagamento à vista"
                          />
                        </label>


                        <button
                          type="submit"
                          className="orbiq-primary-button"
                        >
                          Salvar resposta
                        </button>
                      </div>
                    </form>
                  </details>
                );
              },
            )}
          </div>


          <div className="responses-column-title comparison-title">
            <span className="orbiq-eyebrow">
              2 · COMPARAÇÃO
            </span>

            <h2>
              Escolha a melhor opção de cada peça
            </h2>

            <p>
              O menor preço aparece em destaque, mas a decisão continua sendo sua: marca, disponibilidade e prazo também importam.
            </p>
          </div>


          <div className="quote-comparison-list">
            {items.map(
              (item) => {
                const itemResponses =
                  [
                    ...(
                      responsesByItem.get(
                        item.id,
                      ) ??
                      []
                    ),
                  ].sort(
                    (
                      first,
                      second,
                    ) =>
                      first.total_price -
                      second.total_price,
                  );


                const lowest =
                  itemResponses[
                    0
                  ]?.total_price ??
                  null;


                return (
                  <article
                    key={
                      item.id
                    }
                    className="quote-comparison-item"
                  >
                    <header>
                      <div>
                        <span className="orbiq-eyebrow">
                          {item.category}
                        </span>

                        <h3>
                          {item.description}
                        </h3>

                        <p>
                          {quantity(
                            item.quantity,
                          )}{" "}
                          {item.unit}

                          {item.side
                            ? ` · ${item.side}`
                            : ""}

                          {item.specification
                            ? ` · ${item.specification}`
                            : ""}
                        </p>
                      </div>


                      {item.supplier_id ? (
                        <span className="comparison-selected-badge">
                          Fornecedor escolhido
                        </span>
                      ) : (
                        <span className="comparison-pending-badge">
                          Pendente
                        </span>
                      )}
                    </header>


                    {itemResponses.length ===
                    0 ? (
                      <div className="orbiq-empty compact">
                        <strong>
                          Nenhum fornecedor respondeu esse item.
                        </strong>
                      </div>
                    ) : (
                      <div className="comparison-options">
                        {itemResponses.map(
                          (response) => {
                            const request =
                              requests.find(
                                (current) =>
                                  current.id ===
                                  response.request_id,
                              );


                            const supplier =
                              request
                                ? supplierMap.get(
                                    request.supplier_id,
                                  )
                                : undefined;


                            const isLowest =
                              lowest !==
                                null &&
                              response.total_price ===
                                lowest;


                            const selected =
                              response.awarded ||
                              (
                                item.supplier_id &&
                                supplier?.id ===
                                  item.supplier_id
                              );


                            return (
                              <div
                                key={
                                  response.id
                                }
                                className={
                                  `comparison-option${
                                    selected
                                      ? " selected"
                                      : ""
                                  }${
                                    isLowest
                                      ? " lowest"
                                      : ""
                                  }`
                                }
                              >
                                <div className="comparison-supplier">
                                  <strong>
                                    {supplier?.name ??
                                      "Fornecedor"}
                                  </strong>

                                  <span>
                                    {response.brand_option ??
                                      "Marca não informada"}
                                  </span>
                                </div>


                                <div>
                                  <span>
                                    Unitário
                                  </span>

                                  <strong>
                                    {currency(
                                      response.unit_price,
                                    )}
                                  </strong>
                                </div>


                                <div>
                                  <span>
                                    Total
                                  </span>

                                  <strong>
                                    {currency(
                                      response.total_price,
                                    )}
                                  </strong>

                                  {isLowest ? (
                                    <small>
                                      MENOR PREÇO
                                    </small>
                                  ) : null}
                                </div>


                                <div>
                                  <span>
                                    Disponibilidade
                                  </span>

                                  <strong>
                                    {response.availability ??
                                      "—"}
                                  </strong>

                                  <small>
                                    {response.delivery ??
                                      ""}
                                  </small>
                                </div>


                                <form
                                  action={
                                    chooseSupplierForItemAction
                                  }
                                >
                                  <input
                                    type="hidden"
                                    name="quote_id"
                                    value={
                                      quote.id
                                    }
                                  />

                                  <input
                                    type="hidden"
                                    name="quote_item_id"
                                    value={
                                      item.id
                                    }
                                  />

                                  <input
                                    type="hidden"
                                    name="request_id"
                                    value={
                                      response.request_id
                                    }
                                  />


                                  <button
                                    type="submit"
                                    className={
                                      selected
                                        ? "orbiq-secondary-button"
                                        : "orbiq-primary-button"
                                    }
                                  >
                                    {selected
                                      ? "Selecionado"
                                      : "Escolher"}
                                  </button>
                                </form>
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </div>


          <section className="purchase-approval-panel">
            <div>
              <span className="orbiq-eyebrow">
                3 · FORNECEDORES ESCOLHIDOS
              </span>

              <h2>
                {allItemsChosen
                  ? "Fornecedores definidos"
                  : "Ainda existem peças sem fornecedor"}
              </h2>

              <p>
                {allItemsChosen
                  ? "Confirme os fornecedores escolhidos para retornar ao Comercial e apresentar o orçamento ao cliente."
                  : "Registre as respostas e clique em Escolher para cada peça antes de continuar."}
              </p>
            </div>


            <div className="purchase-approval-total">
              <span>
                Total selecionado
              </span>

              <strong>
                {currency(
                  selectedTotal,
                )}
              </strong>
            </div>


            <form
              action={
                finalizePurchasesAction
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
                disabled={
                  !allItemsChosen
                }
              >
                Confirmar fornecedores escolhidos
              </button>
            </form>
          </section>
        </section>
      )}
    </div>
  );
}