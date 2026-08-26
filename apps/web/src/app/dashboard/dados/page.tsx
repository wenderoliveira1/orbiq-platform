import { requireCurrentPermission } from "../_lib/permissions";

import styles from "./data-governance.module.css";

type PageProps = {
  searchParams: Promise<{
    erro?: string;
  }>;
};

type DataOverviewRow = {
  audit_events_total: number;
  customers_total: number;
  data_records_total: number;
  exports_last_30_days: number;
  last_export_at: string | null;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  quotes_total: number;
  vehicles_total: number;
  work_orders_total: number;
};

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function dateTime(value: string | null) {
  if (!value) {
    return "Nenhuma exportação concluída";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DataGovernancePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const { supabase } = await requireCurrentPermission("data.export");
  const { data, error } = await supabase.rpc(
    "get_owned_data_governance_overview",
  );

  if (error) {
    throw new Error(
      `Falha ao carregar a governança de dados: ${error.message}`,
    );
  }

  const organizations = (data ?? []) as DataOverviewRow[];
  const totalRecords = organizations.reduce(
    (total, organization) =>
      total + Number(organization.data_records_total ?? 0),
    0,
  );
  const exportsLast30Days = organizations.reduce(
    (total, organization) =>
      total + Number(organization.exports_last_30_days ?? 0),
    0,
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className="orbiq-eyebrow">DADOS E LGPD</span>
          <h1>Centro de dados e continuidade</h1>
          <p>
            Inventarie e exporte os dados das suas operações com isolamento por
            oficina, rastreabilidade e proteção de credenciais internas.
          </p>
        </div>

        <span className={styles.ownerBadge}>Somente proprietário</span>
      </section>

      {query.erro ? (
        <div className={styles.errorBanner} role="alert">
          <strong>Exportação não concluída</strong>
          <span>{query.erro.slice(0, 220)}</span>
        </div>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Resumo dos dados">
        <article>
          <span>Operações próprias</span>
          <strong>{number(organizations.length)}</strong>
          <small>oficinas disponíveis para portabilidade</small>
        </article>
        <article>
          <span>Registros inventariados</span>
          <strong>{number(totalRecords)}</strong>
          <small>dados operacionais e eventos de auditoria</small>
        </article>
        <article>
          <span>Exportações em 30 dias</span>
          <strong>{number(exportsLast30Days)}</strong>
          <small>solicitações registradas por proprietário</small>
        </article>
      </section>

      <section className={styles.assurance} aria-label="Garantias da exportação">
        <div className={styles.assuranceHeading}>
          <span className="orbiq-eyebrow">CONTROLES DE SEGURANÇA</span>
          <h2>Portabilidade sem abrir mão da proteção</h2>
        </div>

        <div className={styles.assuranceGrid}>
          <article>
            <span aria-hidden="true">01</span>
            <div>
              <strong>Snapshot consistente</strong>
              <p>Os registros são consolidados em uma única visão lógica.</p>
            </div>
          </article>
          <article>
            <span aria-hidden="true">02</span>
            <div>
              <strong>Segredos removidos</strong>
              <p>Tokens de convites e links públicos nunca entram no arquivo.</p>
            </div>
          </article>
          <article>
            <span aria-hidden="true">03</span>
            <div>
              <strong>Integridade verificável</strong>
              <p>O arquivo inclui SHA-256, versão do schema e data de geração.</p>
            </div>
          </article>
          <article>
            <span aria-hidden="true">04</span>
            <div>
              <strong>Uso único e auditado</strong>
              <p>A autorização expira em 10 minutos e aceita um download.</p>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.operations} aria-label="Dados por oficina">
        <div className={styles.sectionHeading}>
          <div>
            <span className="orbiq-eyebrow">PORTABILIDADE</span>
            <h2>Dados por oficina</h2>
          </div>
          <p>Até 3 novas exportações por hora · limite de 50 MB</p>
        </div>

        <div className={styles.operationGrid}>
          {organizations.map((organization) => (
            <article
              key={organization.organization_id}
              className={styles.operationCard}
              data-testid={`data-operation-${organization.organization_id}`}
            >
              <div className={styles.operationHeader}>
                <div>
                  <h3>{organization.organization_name}</h3>
                  <span>{organization.organization_slug}</span>
                </div>
                <span className={styles.recordBadge}>
                  {number(Number(organization.data_records_total))} registros
                </span>
              </div>

              <dl className={styles.metrics}>
                <div>
                  <dt>Clientes</dt>
                  <dd>{number(Number(organization.customers_total))}</dd>
                </div>
                <div>
                  <dt>Veículos</dt>
                  <dd>{number(Number(organization.vehicles_total))}</dd>
                </div>
                <div>
                  <dt>Orçamentos</dt>
                  <dd>{number(Number(organization.quotes_total))}</dd>
                </div>
                <div>
                  <dt>Ordens de serviço</dt>
                  <dd>{number(Number(organization.work_orders_total))}</dd>
                </div>
                <div>
                  <dt>Eventos auditados</dt>
                  <dd>{number(Number(organization.audit_events_total))}</dd>
                </div>
              </dl>

              <div className={styles.operationFooter}>
                <div>
                  <span>Última exportação</span>
                  <strong>{dateTime(organization.last_export_at)}</strong>
                </div>

                <form action="/dashboard/dados/exportar" method="post">
                  <input
                    type="hidden"
                    name="organization_id"
                    value={organization.organization_id}
                  />
                  <button type="submit" className="orbiq-primary-button">
                    Baixar exportação
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className={styles.privacyNote}>
        <strong>Privacidade por padrão</strong>
        <span>
          O arquivo JSON contém dados pessoais e operacionais da oficina. Guarde-o
          em local protegido e compartilhe apenas quando houver base legal e
          necessidade operacional.
        </span>
      </aside>
    </div>
  );
}
