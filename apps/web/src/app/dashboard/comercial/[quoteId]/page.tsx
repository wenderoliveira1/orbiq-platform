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
  approveCommercialAction,
  rejectCommercialAction,
} from "./actions";

import {
  ReopenLockedQuote,
} from "../../_components/reopen-locked-quote";

import {
  WorkshopLetterhead,
} from "../../_components/workshop-letterhead";

import {
  loadWorkshopBranding,
} from "@/lib/workshop-branding";

import {
  CommercialForm,
} from "./commercial-form";

import {
  PublicQuoteShare,
} from "./public-share";


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
      "Aprovado pelo cliente",

    rejected:
      "Reprovado pelo cliente",
  };


  return (
    labels[
      value
    ] ??
    value
  );
}


export default async function CommercialDetailPage({
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
        "id, protocol, customer_id, vehicle_id, status, priority, mileage, commercial_status, parts_cost_amount, parts_sale_amount, labor_sale_amount, subtotal_amount, discount_type, discount_value, discount_amount, final_amount, commercial_approved_at, commercial_rejected_at, commercial_rejection_reason, created_at",
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
          "id, category, description, labor_amount, needs_part",
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
        .from("quote_items")
        .select(
          "id, description, category, quantity, unit, side, specification, supplier_id, chosen_amount, sale_unit_amount, sale_total_amount",
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
    ]);


  for (
    const result
    of [
      customerResult,
      vehicleResult,
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


  const {
    data: commercialDefaultsData,
    error: commercialDefaultsError,
  } =
    await supabase.rpc(
      "get_organization_commercial_defaults",
      {
        target_org_id:
          organization.id,
      },
    );


  if (
    commercialDefaultsError
  ) {

    throw new Error(
      `Falha ao carregar a margem padrão da oficina: ${commercialDefaultsError.message}`,
    );
  }


  const commercialDefaults =
    commercialDefaultsData as unknown as {
      default_parts_margin_percent:
        number;
    } | null;


  const {
    data: workshopProfileData,
    error: workshopProfileError,
  } =
    await supabase.rpc(
      "get_organization_document_profile",
      {
        target_org_id:
          organization.id,
      },
    );


  if (
    workshopProfileError ||
    !workshopProfileData
  ) {

    throw new Error(
      `Falha ao carregar os dados da oficina: ${
        workshopProfileError?.message ??
        "perfil não encontrado"
      }`,
    );
  }


  const workshop =
    workshopProfileData as unknown as {
      organization_name:
        string;
      organization_cnpj:
        string | null;
      legal_name:
        string | null;
      phone:
        string | null;
      whatsapp:
        string | null;
      email:
        string | null;
      postal_code:
        string | null;
      address_line:
        string | null;
      address_number:
        string | null;
      address_complement:
        string | null;
      district:
        string | null;
      city:
        string | null;
      state:
        string | null;
      quote_validity_days:
        number;
    };


  const branding =
    await loadWorkshopBranding(
      organization.id,
    );


  const workshopContacts =
    [
      workshop.phone
        ? `Telefone ${workshop.phone}`
        : null,
      workshop.whatsapp
        ? `WhatsApp ${workshop.whatsapp}`
        : null,
      workshop.email,
    ]
      .filter(Boolean)
      .join(" · ");


  const workshopAddress =
    [
      [
        workshop.address_line,
        workshop.address_number,
      ]
        .filter(Boolean)
        .join(", "),
      workshop.address_complement,
      workshop.district,
      [
        workshop.city,
        workshop.state,
      ]
        .filter(Boolean)
        .join(" / "),
      workshop.postal_code
        ? `CEP ${workshop.postal_code}`
        : null,
    ]
      .filter(Boolean)
      .join(" - ");


  const customer =
    customerResult.data;


  const vehicle =
    vehicleResult.data;


  const services =
    servicesResult.data ??
    [];


  const items =
    itemsResult.data ??
    [];


  const {
    data: supplierRequests,
    error: supplierRequestsError,
  } =
    await supabase
      .from(
        "quote_supplier_requests",
      )
      .select(
        "id, status",
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
      );


  if (
    supplierRequestsError
  ) {

    throw new Error(
      `Falha ao verificar as cotações dos fornecedores: ${supplierRequestsError.message}`,
    );
  }


  const hasPreparedSupplierRequests =
    (
      supplierRequests ??
      []
    ).length >
    0;


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


  const costPending =
    items.some(
      (item) =>
        item.chosen_amount ===
          null,
    );


  const supplierOptional =
    items.some(
      (item) =>
        item.supplier_id ===
          null,
    );


  const locked =
    quote.commercial_status ===
    "approved";


  return (
    <div className="orbiq-page">

      <section className="commercial-sheet-header">

        <div className="commercial-sheet-toolbar">

          <Link
            href="/dashboard/comercial"
            className="quote-back-link"
          >
            ← Comercial
          </Link>

          <div className="commercial-detail-heading-actions">

            <PublicQuoteShare
              quoteId={
                quote.id
              }
            />

            <span
              className={
                `commercial-status commercial-${quote.commercial_status}`
              }
            >
              {commercialLabel(
                quote.commercial_status,
              )}
            </span>

            <Link
              href={
                `/dashboard/comercial/${quote.id}/cliente`
              }
              className="orbiq-primary-button"
            >
              Versão do cliente
            </Link>

            <Link
              href={
                `/dashboard/orcamentos/${quote.id}`
              }
              className="orbiq-secondary-button"
            >
              Ver orçamento técnico
            </Link>

          </div>

        </div>

        <WorkshopLetterhead
          organizationName={
            workshop.organization_name
          }
          legalName={
            workshop.legal_name
          }
          tagline={
            branding.tagline
          }
          cnpj={
            workshop.organization_cnpj
          }
          contacts={
            workshopContacts ||
            null
          }
          address={
            workshopAddress ||
            null
          }
          protocol={
            quote.protocol
          }
          validityDays={
            workshop.quote_validity_days
          }
        />

        <p className="commercial-sheet-context">
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

      </section>


      {query.ok ? (

        <div className="orbiq-alert success">
          {query.ok === "direct_price"
            ? "Orçamento criado com preço direto. Revise a venda e salve para enviar ao cliente."
            : query.ok}
        </div>

      ) : null}


      {query.error ? (

        <div className="orbiq-alert error">
          {query.error}
        </div>

      ) : null}


      <section className="commercial-context-grid">

        <article className="orbiq-panel">

          <span className="orbiq-eyebrow">
            CLIENTE
          </span>

          <h2>
            {customer?.name ??
              "—"}
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
              E-mail
            </span>

            <strong>
              {customer?.email ??
                "—"}
            </strong>

          </div>

        </article>


        <article className="orbiq-panel">

          <span className="orbiq-eyebrow">
            VEÍCULO
          </span>

          <div className="commercial-vehicle-title">

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
              Status
            </span>

            <strong>
              {statusLabel(
                quote.status,
              )}
            </strong>

          </div>

        </article>

      </section>


      {costPending &&
      items.length >
      0 ? (

        <section className="commercial-warning">

          <div>

            <strong>
              Já tenho o preço — informe o custo das peças
            </strong>

            <span>
              Preencha o custo (Preço direto) e o preço de venda no formulário abaixo para salvar e enviar ao cliente. Cotar fornecedor é opcional.
            </span>

          </div>

        </section>

      ) : null}


      {!costPending &&
      supplierOptional &&
      items.length >
      0 ? (

        <section className="commercial-warning commercial-warning-optional">

          <div>

            <strong>
              Fornecedor opcional
            </strong>

            <span>
              O custo já está definido. Você pode enviar ao cliente agora. Se quiser, ainda pode cotar fornecedores depois para a compra.
            </span>

          </div>


          <Link
            href={
              hasPreparedSupplierRequests
                ? `/dashboard/cotacoes/${quote.id}/respostas`
                : `/dashboard/cotacoes/${quote.id}`
            }
            className="orbiq-secondary-button"
          >
            {hasPreparedSupplierRequests
              ? "Cotar / comparar (opcional)"
              : "Preparar fornecedores (opcional)"}
          </Link>

        </section>

      ) : null}


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              MÃO DE OBRA
            </span>

            <h2>
              Serviços
            </h2>

          </div>

          <strong className="commercial-labor-total">
            {money(
              laborTotal,
            )}
          </strong>

        </div>


        <div className="commercial-services-list">

          {services.map(
            (service) => (

              <article
                key={
                  service.id
                }
              >

                <div>

                  <strong>
                    {service.description}
                  </strong>

                  <span>
                    {service.category}
                  </span>

                </div>


                <strong>
                  {money(
                    service.labor_amount ??
                    0,
                  )}
                </strong>

              </article>

            ),
          )}

        </div>

      </section>


      <CommercialForm
        quoteId={
          quote.id
        }
        laborTotal={
          laborTotal
        }
        items={
          items
        }
        discountType={
          quote.discount_type
        }
        discountValue={
          quote.discount_value
        }
        defaultMargin={
          // % de lucro sobre a venda (não markup sobre custo)
          commercialDefaults?.default_parts_margin_percent ??
          30
        }
        locked={
          locked
        }
      />


      {quote.commercial_status ===
      "ready" ? (

        <section className="commercial-decision-panel">

          <div>

            <span className="orbiq-eyebrow">
              DECISÃO DO CLIENTE
            </span>

            <h2>
              {money(
                quote.final_amount ??
                0,
              )}
            </h2>

            <p>
              Registre somente depois de apresentar o orçamento ao cliente.
            </p>

          </div>


          <div className="commercial-decision-actions">

            <form
              action={
                approveCommercialAction
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
                className="orbiq-primary-button commercial-approve-button"
              >
                ✓ Aprovado pelo cliente
              </button>

            </form>


            <details className="commercial-reject-details">

              <summary>
                Reprovado pelo cliente
              </summary>


              <form
                action={
                  rejectCommercialAction
                }
              >

                <input
                  type="hidden"
                  name="quote_id"
                  value={
                    quote.id
                  }
                />


                <textarea
                  name="reason"
                  rows={3}
                  placeholder="Motivo da reprovação (opcional)"
                />


                <button
                  type="submit"
                  className="orbiq-secondary-button"
                >
                  Confirmar reprovação
                </button>

              </form>

            </details>

          </div>

        </section>

      ) : null}


      {quote.commercial_status ===
      "approved" ? (

        <section className="commercial-approved-banner">

          <div>

            <span className="orbiq-eyebrow">
              APROVADO PELO CLIENTE
            </span>

            <strong>
              {money(
                quote.final_amount ??
                0,
              )}
            </strong>

            <span>
              {items.length >
              0
                ? "O orçamento está liberado para o fluxo de Compras."
                : "O orçamento está liberado para Execução."}
            </span>

          </div>


          <div className="commercial-approved-actions">

            <ReopenLockedQuote
              quoteId={
                quote.id
              }
              returnTo="comercial"
              buttonLabel="Reabrir para editar"
            />

            <Link
              href={
                items.length >
                0
                  ? "/dashboard/compras"
                  : "/dashboard/execucao"
              }
              className="orbiq-primary-button"
            >
              {items.length >
              0
                ? "Ir para Compras"
                : "Ir para Execução"}
            </Link>

          </div>

        </section>

      ) : null}


      {quote.commercial_status ===
      "rejected" ? (

        <section className="commercial-rejected-banner">

          <div>

            <span className="orbiq-eyebrow">
              REPROVADO PELO CLIENTE
            </span>

            <strong>
              Orçamento não aprovado
            </strong>

            {quote.commercial_rejection_reason ? (

              <span>
                Motivo:{" "}
                {quote.commercial_rejection_reason}
              </span>

            ) : null}

          </div>


          <ReopenLockedQuote
            quoteId={
              quote.id
            }
            returnTo="comercial"
            buttonLabel="Reabrir negociação"
          />

        </section>

      ) : null}

    </div>
  );
}