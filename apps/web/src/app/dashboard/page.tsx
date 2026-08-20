import Link from "next/link";

import { getCurrentContext } from "./_lib/current-organization";

function countValue(value: number | null) {
  return new Intl.NumberFormat("pt-BR").format(
    value ?? 0,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const {
    supabase,
    organization,
  } = await getCurrentContext();

  const [
    customersCount,
    vehiclesCount,
    suppliersCount,
    laborCount,
    recentCustomersResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organization.id,
      ),

    supabase
      .from("vehicles")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organization.id,
      ),

    supabase
      .from("suppliers")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organization.id,
      )
      .eq("active", true),

    supabase
      .from("labor_items")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organization.id,
      )
      .eq("active", true),

    supabase
      .from("customers")
      .select(
        "id, name, phone, created_at",
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
      .limit(5),
  ]);

  const recentCustomers =
    recentCustomersResult.data ?? [];

  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">
            VISÃO GERAL
          </span>

          <h1>
            Bom trabalho. O Orbiq está operacional.
          </h1>

          <p>
            Sua oficina já está conectada ao PostgreSQL.
            A partir daqui, clientes e veículos passam a
            fazer parte do fluxo real do sistema.
          </p>
        </div>

        <div className="orbiq-status-pill">
          <span className="orbiq-status-dot" />

          Backend conectado
        </div>
      </section>

      <section className="orbiq-metric-grid">
        <article className="orbiq-metric-card">
          <span>Clientes</span>

          <strong>
            {countValue(customersCount.count)}
          </strong>

          <Link href="/dashboard/clientes">
            Gerenciar clientes →
          </Link>
        </article>

        <article className="orbiq-metric-card">
          <span>Veículos</span>

          <strong>
            {countValue(vehiclesCount.count)}
          </strong>

          <Link href="/dashboard/veiculos">
            Gerenciar veículos →
          </Link>
        </article>

        <article className="orbiq-metric-card">
          <span>
            Fornecedores ativos
          </span>

          <strong>
            {countValue(suppliersCount.count)}
          </strong>

          <small>
            Estrutura pronta para a próxima fase
          </small>
        </article>

        <article className="orbiq-metric-card">
          <span>
            Mão de obra cadastrada
          </span>

          <strong>
            {countValue(laborCount.count)}
          </strong>

          <small>
            Catálogo permanece vazio até você cadastrar
          </small>
        </article>
      </section>

      <section className="orbiq-grid-2">
        <article className="orbiq-panel">
          <div className="orbiq-panel-heading">
            <div>
              <span className="orbiq-eyebrow">
                ACESSO RÁPIDO
              </span>

              <h2>Operação da oficina</h2>
            </div>
          </div>

          <div className="orbiq-quick-actions">
            <Link
              href="/dashboard/clientes"
              className="orbiq-action-card"
            >
              <span className="orbiq-action-icon">
                ◎
              </span>

              <div>
                <strong>Novo cliente</strong>

                <span>
                  Cadastre e localize clientes rapidamente.
                </span>
              </div>

              <b>→</b>
            </Link>

            <Link
              href="/dashboard/veiculos"
              className="orbiq-action-card"
            >
              <span className="orbiq-action-icon">
                ▣
              </span>

              <div>
                <strong>Novo veículo</strong>

                <span>
                  Vincule o veículo ao cliente da oficina.
                </span>
              </div>

              <b>→</b>
            </Link>

            <div className="orbiq-action-card is-muted">
              <span className="orbiq-action-icon">
                ＋
              </span>

              <div>
                <strong>Novo orçamento</strong>

                <span>
                  Será liberado na Fase 1.1.
                </span>
              </div>

              <b>•</b>
            </div>
          </div>
        </article>

        <article className="orbiq-panel">
          <div className="orbiq-panel-heading">
            <div>
              <span className="orbiq-eyebrow">
                RECENTES
              </span>

              <h2>Últimos clientes</h2>
            </div>

            <Link
              href="/dashboard/clientes"
              className="orbiq-inline-link"
            >
              Ver todos
            </Link>
          </div>

          {recentCustomers.length === 0 ? (
            <div className="orbiq-empty compact">
              <strong>
                Nenhum cliente cadastrado ainda.
              </strong>

              <span>
                Seu primeiro cadastro pode ser feito agora.
              </span>
            </div>
          ) : (
            <div className="orbiq-list">
              {recentCustomers.map(
                (customer) => (
                  <div
                    className="orbiq-list-row"
                    key={customer.id}
                  >
                    <span className="orbiq-avatar">
                      {customer.name
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>

                    <div>
                      <strong>
                        {customer.name}
                      </strong>

                      <span>
                        {customer.phone ||
                          "Sem telefone"}
                      </span>
                    </div>

                    <small>
                      {formatDate(
                        customer.created_at,
                      )}
                    </small>
                  </div>
                ),
              )}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}