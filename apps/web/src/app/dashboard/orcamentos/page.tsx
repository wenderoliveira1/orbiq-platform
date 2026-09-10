import Link from "next/link";

import { getCurrentContext } from "../_lib/current-organization";

import { duplicateQuoteAction } from "./[id]/actions";
import {
  matchesQuoteListSearch,
  quotesListHref,
} from "./quote-list-filter";
import {
  PRIORITY_LABELS,
  QUOTE_STATUSES,
  statusLabel,
} from "./quote-meta";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  ok?: string;
  error?: string;
}>;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const qRaw = String(params.q ?? "").trim();
  const selectedStatus = String(params.status ?? "").trim();

  const { supabase, organization } = await getCurrentContext();

  const [quotesResult, customersResult, vehiclesResult] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, customer_id, vehicle_id, protocol, priority, status, mileage, final_amount, created_at, updated_at",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("customers")
      .select("id, name, phone")
      .eq("organization_id", organization.id),
    supabase
      .from("vehicles")
      .select("id, plate, brand, model")
      .eq("organization_id", organization.id),
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

  const customerMap = new Map(
    (customersResult.data ?? []).map(
      (customer) => [customer.id, customer] as const,
    ),
  );

  const vehicleMap = new Map(
    (vehiclesResult.data ?? []).map(
      (vehicle) => [vehicle.id, vehicle] as const,
    ),
  );

  const allQuotes = quotesResult.data ?? [];

  const quotes = allQuotes.filter((quote) => {
    if (selectedStatus && quote.status !== selectedStatus) {
      return false;
    }

    const customer = customerMap.get(quote.customer_id);
    const vehicle = vehicleMap.get(quote.vehicle_id);

    return matchesQuoteListSearch(qRaw, {
      protocol: quote.protocol,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      plate: vehicle?.plate,
      brand: vehicle?.brand,
      model: vehicle?.model,
    });
  });

  const draftQuotes = allQuotes.filter(
    (quote) => quote.status === "estimating",
  ).length;

  const awaitingQuotes = allQuotes.filter(
    (quote) => quote.status === "awaiting_quote",
  ).length;

  const running = allQuotes.filter(
    (quote) =>
      quote.status === "in_progress" || quote.status === "awaiting_parts",
  ).length;

  const completed = allQuotes.filter(
    (quote) => quote.status === "completed",
  ).length;

  const hasFilters = Boolean(qRaw || selectedStatus);

  const metrics: Array<{
    key: string;
    label: string;
    value: number;
    status: string | null;
    testId: string;
  }> = [
    {
      key: "all",
      label: "Total",
      value: allQuotes.length,
      status: "",
      testId: "quote-metric-total",
    },
    {
      key: "estimating",
      label: "Rascunhos",
      value: draftQuotes,
      status: "estimating",
      testId: "quote-metric-drafts",
    },
    {
      key: "awaiting_quote",
      label: "Aguardando cotação",
      value: awaitingQuotes,
      status: "awaiting_quote",
      testId: "quote-metric-awaiting",
    },
    {
      key: "running",
      label: "Em andamento",
      value: running,
      status: null,
      testId: "quote-metric-running",
    },
    {
      key: "completed",
      label: "Finalizados",
      value: completed,
      status: "completed",
      testId: "quote-metric-completed",
    },
  ];

  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">ORÇAMENTOS</span>
          <h1>Histórico de orçamentos</h1>
          <p>
            Consulte atendimentos, pesquise veículos e acompanhe o andamento da
            oficina.
          </p>
        </div>

        <Link
          href="/dashboard/orcamentos/novo"
          className="orbiq-primary-button"
        >
          + Novo orçamento
        </Link>
      </section>

      {params.ok ? (
        <div className="orbiq-alert success">{params.ok}</div>
      ) : null}
      {params.error ? (
        <div className="orbiq-alert error">{params.error}</div>
      ) : null}

      <section
        className="quote-history-metrics"
        data-testid="quote-history-metrics"
        aria-label="Resumo por status"
      >
        {metrics.map((metric) => {
          const filterable = metric.status !== null;
          const isActive =
            filterable &&
            (metric.status === ""
              ? !selectedStatus
              : selectedStatus === metric.status);

          const className = isActive
            ? "quote-history-metric is-active"
            : "quote-history-metric";

          const body = (
            <>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </>
          );

          if (!filterable) {
            return (
              <div
                key={metric.key}
                className={className}
                data-testid={metric.testId}
              >
                {body}
              </div>
            );
          }

          return (
            <Link
              key={metric.key}
              href={quotesListHref({
                q: qRaw,
                status: metric.status || null,
              })}
              className={className}
              data-testid={metric.testId}
              aria-current={isActive ? "page" : undefined}
            >
              {body}
            </Link>
          );
        })}
      </section>

      <section className="orbiq-panel quote-history-panel">
        <form
          action="/dashboard/orcamentos"
          method="get"
          className="quote-history-search"
          data-testid="quote-history-search"
        >
          <input
            name="q"
            defaultValue={qRaw}
            placeholder="Cliente, placa ou ORB-…"
            aria-label="Buscar por cliente, placa ou protocolo"
            data-testid="quote-history-search-q"
            autoComplete="off"
          />

          <select
            name="status"
            defaultValue={selectedStatus}
            aria-label="Filtrar por status"
            data-testid="quote-history-search-status"
          >
            <option value="">Todos os status</option>
            {QUOTE_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <button type="submit" className="orbiq-secondary-button">
            Buscar
          </button>

          {hasFilters ? (
            <Link
              href="/dashboard/orcamentos"
              className="orbiq-secondary-button"
              data-testid="quote-history-search-clear"
            >
              Limpar
            </Link>
          ) : null}
        </form>

        <div className="quote-history-count">
          <strong>{quotes.length}</strong>
          <span>
            orçamento(s)
            {hasFilters ? " filtrado(s)" : ""}
          </span>
        </div>

        {quotes.length === 0 ? (
          <div className="orbiq-empty">
            <strong>Nenhum orçamento encontrado.</strong>
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
            {quotes.map((quote) => {
              const customer = customerMap.get(quote.customer_id);
              const vehicle = vehicleMap.get(quote.vehicle_id);

              return (
                <article key={quote.id} className="quote-history-row">
                  <Link
                    href={`/dashboard/orcamentos/${quote.id}`}
                    className="quote-history-main"
                  >
                    <div className="quote-history-customer">
                      <strong>
                        {customer?.name ?? "Cliente não localizado"}
                      </strong>
                      <span>{customer?.phone ?? "Sem telefone"}</span>
                    </div>

                    <div className="quote-history-vehicle">
                      <span className="orbiq-plate">
                        {vehicle?.plate ?? "—"}
                      </span>
                      <span>
                        {[vehicle?.brand, vehicle?.model]
                          .filter(Boolean)
                          .join(" ") || "Veículo"}
                      </span>
                    </div>

                    <div className="quote-history-tags">
                      <span
                        className={`quote-status status-${quote.status}`}
                        data-testid={
                          quote.status === "estimating"
                            ? "quote-draft-badge"
                            : undefined
                        }
                      >
                        {statusLabel(quote.status)}
                      </span>
                      <small>
                        {PRIORITY_LABELS[quote.priority] ?? quote.priority}
                      </small>
                    </div>

                    <div className="quote-history-protocol">
                      <span>{formatDate(quote.created_at)}</span>
                      <strong>{quote.protocol}</strong>
                    </div>

                    <strong className="quote-history-arrow">→</strong>
                  </Link>

                  <form
                    action={duplicateQuoteAction}
                    className="quote-history-duplicate no-print"
                  >
                    <input type="hidden" name="quote_id" value={quote.id} />
                    <input type="hidden" name="return_to" value="list" />
                    <button
                      type="submit"
                      className="orbiq-secondary-button"
                    >
                      Duplicar
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
