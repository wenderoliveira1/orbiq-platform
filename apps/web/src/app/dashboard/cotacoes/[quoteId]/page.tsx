import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  getCurrentContext,
} from "../../_lib/current-organization";

import {
  prepareQuoteRequestsAction,
} from "./actions";

import {
  CopyManagerSummary,
} from "./copy-manager-summary";

import {
  QuoteSendQueue,
} from "./quote-send-queue";


type PageProps = {
  params:
    Promise<{
      quoteId: string;
    }>;

  searchParams:
    Promise<{
      prepared?: string;
      error?: string;
    }>;
};


function normalize(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase(
      "pt-BR",
    );
}


function formatQuantity(
  value: number,
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


function requestStatusLabel(
  status: string,
): string {
  const labels:
    Record<string, string> = {
      prepared:
        "Pronta",

      opened:
        "WhatsApp aberto",

      responded:
        "Respondida",

      won:
        "Escolhida",

      lost:
        "Não escolhida",

      cancelled:
        "Cancelada",
    };


  return (
    labels[
      status
    ] ??
    status
  );
}


export default async function QuoteSupplierPage({
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
      `Falha carregando orçamento: ${quoteError.message}`,
    );
  }


  if (!quote) {
    notFound();
  }


  const [
    customerResult,
    vehicleResult,
    itemsResult,
    suppliersResult,
    categoriesResult,
    linksResult,
    requestsResult,
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
          "id, category, description, quantity, unit, side, specification, purchase_status",
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
        .from("suppliers")
        .select(
          "id, name, whatsapp, active",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .order(
          "name",
          {
            ascending: true,
          },
        ),

      supabase
        .from("supplier_categories")
        .select(
          "id, name, active",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from("supplier_category_links")
        .select(
          "supplier_id, category_id",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from("quote_supplier_requests")
        .select(
          "id, supplier_id, message, status, opened_at, created_at",
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
    const result
    of [
      customerResult,
      vehicleResult,
      itemsResult,
      suppliersResult,
      categoriesResult,
      linksResult,
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


  const customer =
    customerResult.data;


  const vehicle =
    vehicleResult.data;


  const items =
    itemsResult.data ??
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


  const categoryMap =
    new Map(
      (
        categoriesResult.data ??
        []
      )
        .filter(
          (category) =>
            category.active,
        )
        .map(
          (category) =>
            [
              category.id,
              category.name,
            ] as const,
        ),
    );


  const supplierCategories =
    new Map<
      string,
      Set<string>
    >();


  for (
    const link
    of linksResult.data ??
    []
  ) {
    if (
      !link.supplier_id ||
      !link.category_id
    ) {
      continue;
    }


    const category =
      categoryMap.get(
        link.category_id,
      );


    if (!category) {
      continue;
    }


    const current =
      supplierCategories.get(
        link.supplier_id,
      ) ??
      new Set<string>();


    current.add(
      normalize(
        category,
      ),
    );


    supplierCategories.set(
      link.supplier_id,
      current,
    );
  }


  const candidates =
    suppliers
      .filter(
        (supplier) =>
          supplier.active,
      )
      .map(
        (supplier) => {
          const categories =
            supplierCategories.get(
              supplier.id,
            ) ??
            new Set<string>();


          const matchedItems =
            items.filter(
              (item) =>
                categories.has(
                  normalize(
                    item.category,
                  ),
                ),
            );


          const whatsapp =
            String(
              supplier.whatsapp ??
                "",
            ).replace(
              /\D/g,
              "",
            );


          return {
            supplier,
            matchedItems,
            validWhatsapp:
              whatsapp.length >=
                10 &&
              whatsapp.length <=
                15,
          };
        },
      )
      .filter(
        (candidate) =>
          candidate.matchedItems.length >
          0,
      );


  const requests =
    requestsResult.data ??
    [];


  const activeRequests =
    requests.filter(
      (request) =>
        request.status !==
        "cancelled",
    );


  const queue =
    activeRequests
      .map(
        (request) => {
          const supplier =
            supplierMap.get(
              request.supplier_id,
            );


          if (
            !supplier
          ) {
            return null;
          }


          const whatsapp =
            String(
              supplier.whatsapp ??
                "",
            ).replace(
              /\D/g,
              "",
            );


          return {
            id:
              request.id,

            supplier:
              supplier.name,

            whatsapp,

            status:
              request.status,
          };
        },
      )
      .filter(
        (
          item,
        ): item is {
          id: string;
          supplier: string;
          whatsapp: string;
          status: string;
        } =>
          item !== null,
      );


  const managerSummary =
    [
      `ORBIQ — ${quote.protocol}`,

      "",

      `Cliente: ${customer?.name ?? "Não localizado"}`,

      `Veículo: ${[
        vehicle?.brand,
        vehicle?.model,
        vehicle?.version,
      ]
        .filter(Boolean)
        .join(" ")}`,

      `Placa: ${vehicle?.plate ?? "—"}`,

      "",

      "Peças:",

      ...items.map(
        (item) =>
          `• ${formatQuantity(
            item.quantity,
          )} ${item.unit} — ${item.description} [${item.category}]`,
      ),

      "",

      "Fornecedores encontrados:",

      ...candidates.map(
        (candidate) =>
          `• ${candidate.supplier.name} — ${
            candidate.supplier.whatsapp
              ? "+" +
                String(
                  candidate.supplier.whatsapp,
                ).replace(
                  /\D/g,
                  "",
                )
              : "sem WhatsApp"
          }`,
      ),
    ].join(
      "\n",
    );


  return (
    <div className="orbiq-page">
      <section className="quote-supplier-heading">
        <div>
          <Link
            href="/dashboard/cotacoes"
            className="quote-back-link"
          >
            ← Central de cotações
          </Link>

          <span className="orbiq-eyebrow">
            COTAÇÃO
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


        <div className="quote-supplier-actions">
          <CopyManagerSummary
            text={
              managerSummary
            }
          />

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


      {query.prepared ? (
        <div className="orbiq-alert success">
          {query.prepared} cotação(ões) preparada(s). A fila de WhatsApp está pronta.
        </div>
      ) : null}


      {query.error ? (
        <div className="orbiq-alert error">
          {query.error}
        </div>
      ) : null}


      <section className="orbiq-panel">
        <div className="orbiq-panel-heading">
          <div>
            <span className="orbiq-eyebrow">
              PEÇAS
            </span>

            <h2>
              Itens que precisam de cotação
            </h2>
          </div>

          <span className="orbiq-count-badge">
            {items.length}
          </span>
        </div>


        {items.length ===
        0 ? (
          <div className="orbiq-empty">
            <strong>
              Nenhuma peça.
            </strong>

            <span>
              Esse orçamento não precisa de cotação de fornecedores.
            </span>
          </div>
        ) : (
          <div className="quote-cotation-items">
            {items.map(
              (item) => (
                <div
                  key={
                    item.id
                  }
                >
                  <div>
                    <strong>
                      {item.description}
                    </strong>

                    <span>
                      {item.category}
                    </span>
                  </div>

                  <span>
                    {formatQuantity(
                      item.quantity,
                    )}{" "}
                    {item.unit}
                  </span>

                  <span>
                    {item.side ??
                      "Sem lado"}
                  </span>

                  <span>
                    {item.specification ??
                      "Sem especificação"}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </section>


      <form
        action={
          prepareQuoteRequestsAction
        }
        className="orbiq-panel quote-supplier-selection"
      >
        <input
          type="hidden"
          name="quote_id"
          value={
            quote.id
          }
        />


        <div className="orbiq-panel-heading">
          <div>
            <span className="orbiq-eyebrow">
              FORNECEDORES COMPATÍVEIS
            </span>

            <h2>
              Confira antes de preparar
            </h2>
          </div>

          <span className="orbiq-count-badge">
            {candidates.length}
          </span>
        </div>


        {candidates.length ===
        0 ? (
          <div className="orbiq-empty">
            <strong>
              Nenhum fornecedor compatível.
            </strong>

            <span>
              Cadastre fornecedores nas categorias das peças deste orçamento.
            </span>

            <Link
              href="/dashboard/fornecedores"
              className="orbiq-primary-button"
            >
              Ir para fornecedores
            </Link>
          </div>
        ) : (
          <>
            <div className="quote-supplier-grid">
              {candidates.map(
                (
                  candidate,
                ) => (
                  <label
                    key={
                      candidate.supplier.id
                    }
                    className={
                      candidate.validWhatsapp
                        ? ""
                        : "invalid"
                    }
                  >
                    <input
                      type="checkbox"
                      name="supplier_ids"
                      value={
                        candidate.supplier.id
                      }
                      defaultChecked={
                        candidate.validWhatsapp
                      }
                      disabled={
                        !candidate.validWhatsapp
                      }
                    />


                    <div>
                      <strong>
                        {candidate.supplier.name}
                      </strong>

                      <span>
                        {candidate.validWhatsapp
                          ? "+" +
                            String(
                              candidate.supplier.whatsapp,
                            ).replace(
                              /\D/g,
                              "",
                            )
                          : "WhatsApp inválido"}
                      </span>

                      <small>
                        {candidate.matchedItems.length} item(ns)
                      </small>
                    </div>


                    <div className="supplier-match-tags">
                      {[
                        ...new Set(
                          candidate.matchedItems.map(
                            (item) =>
                              item.category,
                          ),
                        ),
                      ].map(
                        (category) => (
                          <span
                            key={
                              category
                            }
                          >
                            {category}
                          </span>
                        ),
                      )}
                    </div>
                  </label>
                ),
              )}
            </div>


            <div className="quote-prepare-footer">
              <div>
                <strong>
                  Conferência
                </strong>

                <span>
                  Desmarque qualquer fornecedor que não deva receber esta cotação.
                </span>
              </div>

              <button
                type="submit"
                className="orbiq-primary-button"
              >
                Preparar cotações selecionadas
              </button>
            </div>
          </>
        )}
      </form>


      <section className="orbiq-panel">
        <div className="orbiq-panel-heading">
          <div>
            <span className="orbiq-eyebrow">
              ENVIO
            </span>

            <h2>
              Fila rápida de WhatsApp
            </h2>
          </div>

          <span className="orbiq-count-badge">
            {activeRequests.length}
          </span>
        </div>


        <QuoteSendQueue
          requests={
            queue
          }
        />


        {activeRequests.length >
        0 ? (
          <div className="quote-request-list">
            {activeRequests.map(
              (request) => {
                const supplier =
                  supplierMap.get(
                    request.supplier_id,
                  );


                return (
                  <div
                    key={
                      request.id
                    }
                  >
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

                    <span
                      className={
                        `request-status request-${request.status}`
                      }
                    >
                      {requestStatusLabel(
                        request.status,
                      )}
                    </span>

                    <a
                      href={
                        `/dashboard/cotacoes/abrir/${request.id}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="orbiq-secondary-button"
                    >
                      Abrir
                    </a>
                  </div>
                );
              },
            )}
          </div>
        ) : null}
      </section>


      <section className="quote-whatsapp-note">
        <strong>
          Por que existe uma fila?
        </strong>

        <span>
          No WhatsApp comum o navegador não consegue enviar silenciosamente várias mensagens sem interação. O Orbiq já deixa número e mensagem prontos; cada clique abre o próximo fornecedor. Envio realmente automático será feito futuramente pela WhatsApp Business Platform.
        </span>
      </section>
    </div>
  );
}