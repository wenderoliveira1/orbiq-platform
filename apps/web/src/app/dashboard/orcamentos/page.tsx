import Link from "next/link";

import {
  getCurrentContext,
} from "../_lib/current-organization";

import {
  PRIORITY_LABELS,
  QUOTE_STATUSES,
  statusLabel,
} from "./quote-meta";


type SearchParams = Promise<{
  q?: string;
  status?: string;
}>;


function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}


export default async function QuotesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params =
    await searchParams;


  const q =
    String(
      params.q ?? "",
    )
      .trim()
      .toLocaleLowerCase(
        "pt-BR",
      );


  const selectedStatus =
    String(
      params.status ?? "",
    ).trim();


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const [
    quotesResult,
    customersResult,
    vehiclesResult,
  ] =
    await Promise.all([
      supabase
        .from("quotes")
        .select(
          "id, customer_id, vehicle_id, protocol, priority, status, mileage, final_amount, created_at, updated_at",
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
        .limit(250),

      supabase
        .from("customers")
        .select(
          "id, name, phone",
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
    ]);


  if (quotesResult.error) {
    throw new Error(
      `Falha ao carregar orçamentos: ${quotesResult.error.message}`,
    );
  }


  if (customersResult.error) {
    throw new Error(
      `Falha ao carregar clientes: ${customersResult.error.message}`,
    );
  }


  if (vehiclesResult.error) {
    throw new Error(
      `Falha ao carregar veículos: ${vehiclesResult.error.message}`,
    );
  }


  const customerMap =
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


  const vehicleMap =
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


  const allQuotes =
    quotesResult.data ??
    [];


  const quotes =
    allQuotes.filter(
      (quote) => {
        if (
          selectedStatus &&
          quote.status !==
            selectedStatus
        ) {
          return false;
        }


        if (!q) {
          return true;
        }


        const customer =
          customerMap.get(
            quote.customer_id,
          );


        const vehicle =
          vehicleMap.get(
            quote.vehicle_id,
          );


        const searchable =
          [
            quote.protocol,
            customer?.name,
            customer?.phone,
            vehicle?.plate,
            vehicle?.brand,
            vehicle?.model,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase(
              "pt-BR",
            );


        return searchable.includes(
          q,
        );
      },
    );


  const awaitingQuotes =
    allQuotes.filter(
      (quote) =>
        quote.status ===
        "awaiting_quote",
    ).length;


  const running =
    allQuotes.filter(
      (quote) =>
        quote.status ===
          "in_progress" ||
        quote.status ===
          "awaiting_parts",
    ).length;


  const completed =
    allQuotes.filter(
      (quote) =>
        quote.status ===
        "completed",
    ).length;


  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">
            ORÇAMENTOS
          </span>

          <h1>
            Histórico de orçamentos
          </h1>

          <p>
            Consulte atendimentos, pesquise veículos e acompanhe o andamento da oficina.
          </p>
        </div>

        <Link
          href="/dashboard/orcamentos/novo"
          className="orbiq-primary-button"
        >
          + Novo orçamento
        </Link>
      </section>


      <section className="quote-history-metrics">
        <article>
          <span>Total</span>

          <strong>
            {allQuotes.length}
          </strong>
        </article>

        <article>
          <span>
            Aguardando cotação
          </span>

          <strong>
            {awaitingQuotes}
          </strong>
        </article>

        <article>
          <span>
            Em andamento
          </span>

          <strong>
            {running}
          </strong>
        </article>

        <article>
          <span>
            Finalizados
          </span>

          <strong>
            {completed}
          </strong>
        </article>
      </section>


      <section className="orbiq-panel">
        <form
          action="/dashboard/orcamentos"
          className="quote-history-search"
        >
          <input
            name="q"
            defaultValue={
              params.q ?? ""
            }
            placeholder="Buscar protocolo, cliente, telefone ou placa"
          />

          <select
            name="status"
            defaultValue={
              selectedStatus
            }
          >
            <option value="">
              Todos os status
            </option>

            {QUOTE_STATUSES.map(
              (status) => (
                <option
                  key={
                    status.value
                  }
                  value={
                    status.value
                  }
                >
                  {status.label}
                </option>
              ),
            )}
          </select>

          <button
            type="submit"
            className="orbiq-secondary-button"
          >
            Buscar
          </button>

          {q ||
          selectedStatus ? (
            <Link
              href="/dashboard/orcamentos"
              className="orbiq-secondary-button"
            >
              Limpar
            </Link>
          ) : null}
        </form>
      </section>


      <section className="orbiq-panel">
        <div className="orbiq-panel-heading">
          <div>
            <span className="orbiq-eyebrow">
              RESULTADOS
            </span>

            <h2>
              {quotes.length} orçamento(s)
            </h2>
          </div>
        </div>


        {quotes.length ===
        0 ? (
          <div className="orbiq-empty">
            <strong>
              Nenhum orçamento encontrado.
            </strong>

            <span>
              Ajuste os filtros ou realize um novo orçamento.
            </span>

            <Link
              href="/dashboard/orcamentos/novo"
              className="orbiq-primary-button"
            >
              Novo orçamento
            </Link>
          </div>
        ) : (
          <div className="quote-history-list">
            {quotes.map(
              (quote) => {
                const customer =
                  customerMap.get(
                    quote.customer_id,
                  );


                const vehicle =
                  vehicleMap.get(
                    quote.vehicle_id,
                  );


                return (
                  <Link
                    key={
                      quote.id
                    }
                    href={
                      `/dashboard/orcamentos/${quote.id}`
                    }
                    className="quote-history-row"
                  >
                    <div className="quote-history-protocol">
                      <strong>
                        {quote.protocol}
                      </strong>

                      <span>
                        {formatDate(
                          quote.created_at,
                        )}
                      </span>
                    </div>


                    <div className="quote-history-customer">
                      <strong>
                        {customer?.name ??
                          "Cliente não localizado"}
                      </strong>

                      <span>
                        {customer?.phone ??
                          "Sem telefone"}
                      </span>
                    </div>


                    <div className="quote-history-vehicle">
                      <span className="orbiq-plate">
                        {vehicle?.plate ??
                          "—"}
                      </span>

                      <span>
                        {[
                          vehicle?.brand,
                          vehicle?.model,
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                          "Veículo"}
                      </span>
                    </div>


                    <div className="quote-history-tags">
                      <span
                        className={
                          `quote-status status-${quote.status}`
                        }
                      >
                        {statusLabel(
                          quote.status,
                        )}
                      </span>

                      <small>
                        {PRIORITY_LABELS[
                          quote.priority
                        ] ??
                          quote.priority}
                      </small>
                    </div>


                    <strong className="quote-history-arrow">
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