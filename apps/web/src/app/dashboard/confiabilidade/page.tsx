import Link from "next/link";

import { requireCurrentPermission } from "../_lib/permissions";

import { resolveIncidentAction } from "./actions";
import styles from "./reliability.module.css";

type PageProps = {
  searchParams: Promise<{
    oficina?: string;
    pagina?: string;
    q?: string;
    status?: string;
  }>;
};

type OrganizationRow = {
  organization_id: string;
  organization_name: string;
};

type IncidentRow = {
  fingerprint: string;
  first_seen_at: string;
  incident_id: string;
  last_seen_at: string;
  occurrences: number;
  organization_id: string;
  organization_name: string;
  reporter_user_id: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  route: string;
  source: string;
  total_count: number;
};

const PAGE_SIZE = 30;

const statusOptions = [
  ["open", "Em aberto"],
  ["resolved", "Resolvidos"],
  ["all", "Todos"],
] as const;

const sourceLabels: Record<string, string> = {
  dashboard_error: "Dashboard",
  global_error: "Aplicação",
  server_action: "Operação do servidor",
};

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function dateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function pageHref(query: Awaited<PageProps["searchParams"]>, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key !== "pagina" && value?.trim()) {
      params.set(key, value.trim());
    }
  }

  if (page > 1) {
    params.set("pagina", String(page));
  }

  const suffix = params.toString();
  return suffix ? `/dashboard/confiabilidade?${suffix}` : "/dashboard/confiabilidade";
}

export default async function ReliabilityPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const { supabase } = await requireCurrentPermission("network.view");

  const selectedStatus = statusOptions.some(([value]) => value === query.status)
    ? query.status ?? "open"
    : "open";
  const search = (query.q ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(query.pagina ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 334)
    : 1;

  const { data: organizationData, error: organizationError } = await supabase.rpc(
    "get_owned_organization_overview",
    { report_month: new Date().toISOString().slice(0, 7) + "-01" },
  );

  if (organizationError) {
    throw new Error(`Falha ao carregar as oficinas da rede: ${organizationError.message}`);
  }

  const organizations = (organizationData ?? []) as OrganizationRow[];
  const selectedOrganizationId = organizations.some(
    (candidate) => candidate.organization_id === query.oficina,
  )
    ? query.oficina ?? null
    : null;

  const organizationIds = organizations.map((item) => item.organization_id);

  const [{ data: incidentsData, error: incidentsError }, { data: summaryData, error: summaryError }] = await Promise.all([
    supabase.rpc("get_owned_application_incidents", {
      filter_organization_id: selectedOrganizationId ?? undefined,
      filter_status: selectedStatus,
      filter_query: search || undefined,
      result_limit: PAGE_SIZE,
      result_offset: (currentPage - 1) * PAGE_SIZE,
    }),
    supabase
      .from("application_incidents")
      .select("id, organization_id, occurrences, resolved_at")
      .in("organization_id", organizationIds),
  ]);

  if (incidentsError) {
    throw new Error(`Falha ao carregar a central de confiabilidade: ${incidentsError.message}`);
  }

  if (summaryError) {
    throw new Error(`Falha ao carregar os indicadores de confiabilidade: ${summaryError.message}`);
  }

  const incidents = (incidentsData ?? []) as IncidentRow[];
  const summary = summaryData ?? [];
  const openCount = summary.filter((incident) => !incident.resolved_at).length;
  const resolvedCount = summary.length - openCount;
  const recurringCount = summary.filter((incident) => Number(incident.occurrences) >= 3).length;
  const affectedOrganizations = new Set(summary.map((incident) => incident.organization_id)).size;
  const totalCount = Number(incidents[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const teamResults = await Promise.all(
    organizations.map(async (organization) => {
      const result = await supabase.rpc("list_organization_team", {
        target_org_id: organization.organization_id,
      });

      if (result.error) {
        throw new Error(`Falha ao identificar responsáveis em ${organization.organization_name}: ${result.error.message}`);
      }

      return {
        organizationId: organization.organization_id,
        members: result.data ?? [],
      };
    }),
  );

  const people = new Map<string, string>();

  for (const team of teamResults) {
    for (const member of team.members) {
      people.set(
        `${team.organizationId}:${member.user_id}`,
        member.full_name || member.email || "Usuário",
      );
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className="orbiq-eyebrow">CONFIABILIDADE</span>
          <h1>Central de incidentes</h1>
          <p>
            Falhas inesperadas são agrupadas por assinatura técnica, sem armazenar mensagens, stack traces ou dados pessoais do usuário.
          </p>
        </div>

        <Link href="/dashboard/rede/atividade" className="orbiq-secondary-button">
          Abrir governança
        </Link>
      </section>

      <section className={styles.summaryGrid} aria-label="Resumo de confiabilidade">
        <article className={openCount > 0 ? styles.summaryAttention : ""}>
          <span>Em aberto</span>
          <strong>{number(openCount)}</strong>
          <small>incidentes aguardando análise</small>
        </article>
        <article>
          <span>Resolvidos</span>
          <strong>{number(resolvedCount)}</strong>
          <small>incidentes encerrados com rastreabilidade</small>
        </article>
        <article>
          <span>Recorrentes</span>
          <strong>{number(recurringCount)}</strong>
          <small>três ou mais ocorrências</small>
        </article>
        <article>
          <span>Operações impactadas</span>
          <strong>{number(affectedOrganizations)}</strong>
          <small>de {number(organizations.length)} oficina(s) própria(s)</small>
        </article>
      </section>

      <section className={styles.filterPanel}>
        <form method="get" className={styles.filters}>
          <label>
            <span>Oficina</span>
            <select name="oficina" defaultValue={selectedOrganizationId ?? "all"}>
              <option value="all">Todas as operações</option>
              {organizations.map((organization) => (
                <option key={organization.organization_id} value={organization.organization_id}>
                  {organization.organization_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={selectedStatus}>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className={styles.searchField}>
            <span>Pesquisar</span>
            <input
              type="search"
              name="q"
              defaultValue={search}
              maxLength={100}
              placeholder="Oficina, rota ou código de rastreio..."
            />
          </label>

          <button type="submit" className="orbiq-secondary-button">Aplicar filtros</button>
          <Link href="/dashboard/confiabilidade" className={styles.clearFilters}>Limpar</Link>
        </form>
      </section>

      <section className={styles.incidentPanel} aria-label="Incidentes da aplicação">
        <div className={styles.panelHeading}>
          <div>
            <span className="orbiq-eyebrow">OBSERVABILIDADE</span>
            <h2>Incidentes registrados</h2>
          </div>
          <span className={styles.countBadge}>{number(totalCount)}</span>
        </div>

        {incidents.length === 0 ? (
          <div className={styles.empty}>
            <strong>Nenhum incidente encontrado.</strong>
            <span>O ambiente está estável para os filtros selecionados.</span>
          </div>
        ) : (
          <div className={styles.incidentList}>
            {incidents.map((incident) => {
              const reporter = incident.reporter_user_id
                ? people.get(`${incident.organization_id}:${incident.reporter_user_id}`) ?? "Usuário"
                : "Sistema";
              const resolver = incident.resolved_by
                ? people.get(`${incident.organization_id}:${incident.resolved_by}`) ?? "Proprietário"
                : null;
              const open = !incident.resolved_at;

              return (
                <article
                  key={incident.incident_id}
                  className={styles.incident}
                  data-testid={`incident-${incident.incident_id}`}
                >
                  <div className={styles.incidentHeader}>
                    <div>
                      <span className={open ? styles.openBadge : styles.resolvedBadge}>
                        {open ? "Em aberto" : "Resolvido"}
                      </span>
                      <h3>{incident.route}</h3>
                    </div>
                    <strong className={styles.occurrences}>
                      {number(Number(incident.occurrences))} ocorrência(s)
                    </strong>
                  </div>

                  <dl className={styles.details}>
                    <div><dt>Oficina</dt><dd>{incident.organization_name}</dd></div>
                    <div><dt>Origem</dt><dd>{sourceLabels[incident.source] ?? incident.source}</dd></div>
                    <div><dt>Primeiro registro</dt><dd>{dateTime(incident.first_seen_at)}</dd></div>
                    <div><dt>Último registro</dt><dd>{dateTime(incident.last_seen_at)}</dd></div>
                    <div><dt>Responsável da sessão</dt><dd>{reporter}</dd></div>
                    <div><dt>Código técnico</dt><dd><code>{incident.fingerprint}</code></dd></div>
                  </dl>

                  {open ? (
                    <form action={resolveIncidentAction} className={styles.resolveForm}>
                      <input type="hidden" name="incident_id" value={incident.incident_id} />
                      <label>
                        <span>Observação da resolução</span>
                        <input
                          type="text"
                          name="resolution_note"
                          maxLength={500}
                          aria-label={`Observação para resolver ${incident.fingerprint}`}
                          placeholder="Ex.: corrigido e validado no Quality Gate"
                        />
                      </label>
                      <button type="submit" className="orbiq-secondary-button">
                        Marcar como resolvido
                      </button>
                    </form>
                  ) : (
                    <div className={styles.resolution}>
                      <strong>Resolvido por {resolver ?? "Proprietário"} em {dateTime(incident.resolved_at)}</strong>
                      {incident.resolution_note ? <span>{incident.resolution_note}</span> : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <nav className={styles.pagination} aria-label="Paginação dos incidentes">
            {currentPage > 1 ? <Link href={pageHref(query, currentPage - 1)}>← Anterior</Link> : <span />}
            <strong>Página {Math.min(currentPage, totalPages)} de {totalPages}</strong>
            {currentPage < totalPages ? <Link href={pageHref(query, currentPage + 1)}>Próxima →</Link> : <span />}
          </nav>
        ) : null}
      </section>

      <section className={styles.privacyNote}>
        <strong>Privacidade por padrão</strong>
        <span>O Orbiq registra apenas assinatura, origem, rota, contagem e contexto organizacional. Mensagens de erro, stack traces, parâmetros e conteúdo digitado não são persistidos.</span>
      </section>
    </div>
  );
}
