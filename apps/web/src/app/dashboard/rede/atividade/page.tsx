import Link from "next/link";

import { requireCurrentPermission } from "../../_lib/permissions";

import { OpenNetworkEventButton } from "./open-network-event-button";
import styles from "./network-governance.module.css";

type PageProps = {
  searchParams: Promise<{
    oficina?: string;
    pagina?: string;
    periodo?: string;
    q?: string;
    tipo?: string;
  }>;
};

type NetworkOverviewRow = {
  organization_id: string;
  organization_name: string;
};

type NetworkActivityRow = {
  action: string;
  actor_type: string;
  actor_user_id: string | null;
  category: string;
  client_count: number;
  created_at: string;
  customer_name: string | null;
  entity_id: string | null;
  entity_type: string;
  event_id: string;
  governance_count: number;
  metadata: unknown;
  organization_id: string;
  organization_name: string;
  organizations_with_activity: number;
  quote_id: string | null;
  quote_protocol: string | null;
  total_count: number;
  vehicle_plate: string | null;
};

type AuditMetadata = Record<string, unknown>;

const PAGE_SIZE = 40;

const periodOptions = [
  ["1", "Últimas 24 horas"],
  ["7", "Últimos 7 dias"],
  ["30", "Últimos 30 dias"],
  ["90", "Últimos 90 dias"],
] as const;

const categoryOptions = [
  ["all", "Todas as categorias"],
  ["governance", "Governança"],
  ["quote", "Orçamentos"],
  ["commercial", "Comercial"],
  ["supplier", "Fornecedores"],
  ["purchase", "Compras"],
  ["execution", "Execução"],
  ["share", "Links públicos"],
  ["other", "Outros"],
] as const;

const categoryLabels = new Map<string, string>(categoryOptions);

function metadata(value: unknown): AuditMetadata {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AuditMetadata;
  }

  return {};
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return null;
}

function number(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function actionInfo(action: string, data: AuditMetadata) {
  const from = stringValue(data.from);
  const to = stringValue(data.to);

  const known: Record<string, { description: string; icon: string; title: string }> = {
    "organization.created": {
      title: "Oficina criada",
      description: "Uma nova operação foi adicionada à rede.",
      icon: "+",
    },
    "team.invite_created": {
      title: "Convite de equipe criado",
      description: stringValue(data.email)
        ? `Convite enviado para ${stringValue(data.email)}.`
        : "Um novo convite foi emitido.",
      icon: "♙",
    },
    "team.invite_accepted": {
      title: "Convite aceito",
      description: stringValue(data.email)
        ? `${stringValue(data.email)} entrou na equipe.`
        : "Um profissional entrou na equipe.",
      icon: "✓",
    },
    "team.member_role_changed": {
      title: "Função da equipe alterada",
      description: from && to ? `${from} → ${to}` : "A função de um membro foi atualizada.",
      icon: "↻",
    },
    "team.member_status_changed": {
      title: "Acesso da equipe alterado",
      description: from && to ? `${from} → ${to}` : "O acesso de um membro foi atualizado.",
      icon: "↻",
    },
    "reliability.incident_resolved": {
      title: "Incidente resolvido",
      description: stringValue(data.fingerprint)
        ? `A ocorrência ${stringValue(data.fingerprint)} foi analisada e encerrada.`
        : "Uma ocorrência técnica foi analisada e encerrada.",
      icon: "✓",
    },
    "quote.created": {
      title: "Orçamento criado",
      description: "Um novo atendimento entrou no Orbiq.",
      icon: "+",
    },
    "quote.status_changed": {
      title: "Status do orçamento alterado",
      description: from && to ? `${from} → ${to}` : "O fluxo operacional foi atualizado.",
      icon: "↻",
    },
    "quote.commercial_status_changed": {
      title: to === "approved" ? "Orçamento aprovado" : to === "rejected" ? "Orçamento reprovado" : "Comercial atualizado",
      description: from && to ? `${from} → ${to}` : "O status comercial foi atualizado.",
      icon: to === "approved" ? "✓" : to === "rejected" ? "×" : "$",
    },
    "supplier.awarded": {
      title: "Fornecedor escolhido",
      description: "Uma proposta foi selecionada para a peça.",
      icon: "◇",
    },
    "purchase.created": {
      title: "Pedido de compra criado",
      description: stringValue(data.code) ? `Pedido ${stringValue(data.code)} criado.` : "Um novo pedido foi criado.",
      icon: "□",
    },
    "purchase.status_changed": {
      title: "Compra atualizada",
      description: from && to ? `${from} → ${to}` : "O pedido de compra foi atualizado.",
      icon: "□",
    },
    "work_order.created": {
      title: "Ordem de serviço criada",
      description: stringValue(data.code) ? `OS ${stringValue(data.code)} criada.` : "Uma nova ordem de serviço foi criada.",
      icon: "▶",
    },
    "work_order.status_changed": {
      title: "Execução atualizada",
      description: from && to ? `${from} → ${to}` : "A execução da ordem de serviço mudou.",
      icon: "▶",
    },
    "public_link.created": {
      title: "Link do cliente criado",
      description: "O orçamento recebeu um novo link público.",
      icon: "↗",
    },
    "public_link.revoked": {
      title: "Link do cliente revogado",
      description: "O acesso público anterior deixou de funcionar.",
      icon: "×",
    },
  };

  return known[action] ?? {
    title: "Atividade registrada",
    description: action,
    icon: "•",
  };
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
  return suffix ? `/dashboard/rede/atividade?${suffix}` : "/dashboard/rede/atividade";
}

export default async function NetworkGovernancePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const { supabase, organization } = await requireCurrentPermission("network.view");

  const selectedPeriod = periodOptions.some(([value]) => value === query.periodo)
    ? Number(query.periodo)
    : 30;
  const selectedCategory = categoryOptions.some(([value]) => value === query.tipo)
    ? query.tipo ?? "all"
    : "all";
  const search = (query.q ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(query.pagina ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 251)
    : 1;

  const { data: overviewData, error: overviewError } = await supabase.rpc(
    "get_owned_organization_overview",
    { report_month: new Date().toISOString().slice(0, 7) + "-01" },
  );

  if (overviewError) {
    throw new Error(`Falha ao carregar as oficinas da rede: ${overviewError.message}`);
  }

  const organizations = (overviewData ?? []) as NetworkOverviewRow[];
  const selectedOrganizationId = organizations.some(
    (candidate) => candidate.organization_id === query.oficina,
  )
    ? query.oficina ?? null
    : null;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - selectedPeriod);

  const { data: activityData, error: activityError } = await supabase.rpc(
    "get_owned_network_activity",
    {
      filter_organization_id: selectedOrganizationId ?? undefined,
      filter_category: selectedCategory === "all" ? undefined : selectedCategory,
      filter_period_start: periodStart.toISOString(),
      filter_period_end: periodEnd.toISOString(),
      filter_query: search || undefined,
      result_limit: PAGE_SIZE,
      result_offset: (currentPage - 1) * PAGE_SIZE,
    },
  );

  if (activityError) {
    throw new Error(`Falha ao carregar a auditoria consolidada: ${activityError.message}`);
  }

  const events = (activityData ?? []) as NetworkActivityRow[];
  const summary = events[0];
  const totalCount = Number(summary?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const teamResults = await Promise.all(
    organizations.map(async (candidate) => {
      const result = await supabase.rpc("list_organization_team", {
        target_org_id: candidate.organization_id,
      });

      if (result.error) {
        throw new Error(`Falha ao identificar responsáveis em ${candidate.organization_name}: ${result.error.message}`);
      }

      return {
        organizationId: candidate.organization_id,
        members: result.data ?? [],
      };
    }),
  );

  const actorNames = new Map<string, string>();

  for (const team of teamResults) {
    for (const member of team.members) {
      actorNames.set(
        `${team.organizationId}:${member.user_id}`,
        member.full_name || member.email || "Usuário",
      );
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className="orbiq-eyebrow">GOVERNANÇA</span>
          <h1>Auditoria consolidada da rede</h1>
          <p>
            Acompanhe ações operacionais e administrativas de todas as suas oficinas sem romper o isolamento de cada organização.
          </p>
        </div>

        <Link href="/dashboard/rede" className="orbiq-secondary-button">
          Voltar à visão da rede
        </Link>
      </section>

      <section className={styles.summaryGrid} aria-label="Resumo da auditoria da rede">
        <article>
          <span>Eventos no período</span>
          <strong>{number(totalCount)}</strong>
          <small>considerando os filtros aplicados</small>
        </article>
        <article>
          <span>Governança</span>
          <strong>{number(Number(summary?.governance_count ?? 0))}</strong>
          <small>equipe, acessos e oficinas</small>
        </article>
        <article>
          <span>Decisões do cliente</span>
          <strong>{number(Number(summary?.client_count ?? 0))}</strong>
          <small>ações realizadas por link público</small>
        </article>
        <article className={styles.summaryHighlight}>
          <span>Operações com atividade</span>
          <strong>{number(Number(summary?.organizations_with_activity ?? 0))}</strong>
          <small>de {number(organizations.length)} oficina(s) própria(s)</small>
        </article>
      </section>

      <section className={styles.filterPanel}>
        <form method="get" className={styles.filters}>
          <label>
            <span>Oficina</span>
            <select name="oficina" defaultValue={selectedOrganizationId ?? "all"}>
              <option value="all">Todas as operações</option>
              {organizations.map((candidate) => (
                <option key={candidate.organization_id} value={candidate.organization_id}>
                  {candidate.organization_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Período</span>
            <select name="periodo" defaultValue={String(selectedPeriod)}>
              {periodOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Categoria</span>
            <select name="tipo" defaultValue={selectedCategory}>
              {categoryOptions.map(([value, label]) => (
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
              placeholder="Oficina, ação, protocolo, cliente, placa..."
            />
          </label>

          <button type="submit" className="orbiq-secondary-button">Aplicar filtros</button>
          <Link href="/dashboard/rede/atividade" className={styles.clearFilters}>Limpar</Link>
        </form>
      </section>

      <section
        className={styles.timelinePanel}
        aria-label="Atividades da rede"
      >
        <div className={styles.panelHeading}>
          <div>
            <span className="orbiq-eyebrow">RASTREABILIDADE</span>
            <h2>Atividades da rede</h2>
          </div>
          <span className={styles.countBadge}>{number(totalCount)}</span>
        </div>

        {events.length === 0 ? (
          <div className={styles.empty}>
            <strong>Nenhuma atividade encontrada.</strong>
            <span>Ajuste os filtros ou amplie o período consultado.</span>
          </div>
        ) : (
          <div className={styles.timeline}>
            {events.map((event) => {
              const data = metadata(event.metadata);
              const info = actionInfo(event.action, data);
              const actor = event.actor_type === "client"
                ? "Cliente"
                : event.actor_type === "system"
                  ? "Sistema"
                  : event.actor_user_id
                    ? actorNames.get(`${event.organization_id}:${event.actor_user_id}`) ?? "Usuário"
                    : "Usuário";

              return (
                <article key={event.event_id} className={styles.event} data-testid={`network-event-${event.event_id}`}>
                  <div className={styles.eventIcon} aria-hidden="true">{info.icon}</div>

                  <div className={styles.eventMain}>
                    <div className={styles.eventTitle}>
                      <strong>{info.title}</strong>
                      <span>{dateTime(event.created_at)}</span>
                    </div>
                    <p>{info.description}</p>
                    <div className={styles.eventMeta}>
                      <span>Oficina: <strong>{event.organization_name}</strong></span>
                      <span>Por: <strong>{actor}</strong></span>
                      <span>Categoria: <strong>{categoryLabels.get(event.category) ?? "Outros"}</strong></span>
                      {event.quote_protocol ? <span>Orçamento: <strong>{event.quote_protocol}</strong></span> : null}
                      {event.customer_name ? <span>Cliente: <strong>{event.customer_name}</strong></span> : null}
                      {event.vehicle_plate ? <span>Placa: <strong>{event.vehicle_plate}</strong></span> : null}
                    </div>
                  </div>

                  <OpenNetworkEventButton
                    active={event.organization_id === organization.id}
                    organizationId={event.organization_id}
                    organizationName={event.organization_name}
                    quoteId={event.quote_id}
                  />
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <nav className={styles.pagination} aria-label="Paginação da auditoria">
            {currentPage > 1 ? <Link href={pageHref(query, currentPage - 1)}>← Anterior</Link> : <span />}
            <strong>Página {Math.min(currentPage, totalPages)} de {totalPages}</strong>
            {currentPage < totalPages ? <Link href={pageHref(query, currentPage + 1)}>Próxima →</Link> : <span />}
          </nav>
        ) : null}
      </section>

      <section className={styles.securityNote}>
        <strong>Isolamento preservado</strong>
        <span>Esta central consulta somente oficinas em que sua conta possui vínculo ativo de proprietário. Gerentes e outras redes são bloqueados também no banco.</span>
      </section>
    </div>
  );
}
