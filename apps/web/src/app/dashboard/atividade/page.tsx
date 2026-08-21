import Link from "next/link";

import {
  getCurrentContext,
} from "../_lib/current-organization";


type PageProps = {

  searchParams:
    Promise<{
      tipo?: string;
      q?: string;
    }>;
};


type AuditMetadata =
  Record<
    string,
    unknown
  >;


function metadata(
  value:
    unknown,
): AuditMetadata {

  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  ) {

    return value as AuditMetadata;
  }


  return {};
}


function stringValue(
  value:
    unknown,
): string | null {

  if (
    typeof value ===
    "string"
  ) {

    return value;
  }


  if (
    typeof value ===
      "number"
  ) {

    return String(
      value,
    );
  }


  return null;
}


function money(
  value:
    unknown,
): string | null {

  const number =
    typeof value ===
      "number"
      ? value
      : typeof value ===
        "string"
        ? Number(
            value,
          )
        : Number.NaN;


  if (
    !Number.isFinite(
      number,
    )
  ) {

    return null;
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
    number,
  );
}


function dateTime(
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

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


function actionCategory(
  action:
    string,
): string {

  if (
    action.startsWith(
      "quote.commercial",
    )
  ) {

    return "commercial";
  }


  if (
    action.startsWith(
      "quote.",
    )
  ) {

    return "quote";
  }


  if (
    action.startsWith(
      "supplier.",
    )
  ) {

    return "supplier";
  }


  if (
    action.startsWith(
      "purchase.",
    )
  ) {

    return "purchase";
  }


  if (
    action.startsWith(
      "work_order.",
    )
  ) {

    return "execution";
  }


  if (
    action.startsWith(
      "public_link.",
    )
  ) {

    return "share";
  }


  return "other";
}


function actionInfo(
  action:
    string,

  data:
    AuditMetadata,
): {
  title: string;
  description: string;
  icon: string;
} {

  const from =
    stringValue(
      data.from,
    );


  const to =
    stringValue(
      data.to,
    );


  if (
    action ===
    "quote.created"
  ) {

    return {
      title:
        "Orçamento criado",

      description:
        "Um novo atendimento entrou no Orbiq.",

      icon:
        "+",
    };
  }


  if (
    action ===
    "quote.status_changed"
  ) {

    return {
      title:
        "Status do orçamento alterado",

      description:
        from &&
        to
          ? `${from} → ${to}`
          : "O fluxo operacional foi atualizado.",

      icon:
        "↻",
    };
  }


  if (
    action ===
    "quote.commercial_status_changed"
  ) {

    if (
      to ===
      "approved"
    ) {

      return {
        title:
          "Orçamento aprovado",

        description:
          money(
            data.final_amount,
          )
            ? `Cliente aprovou ${money(
                data.final_amount,
              )}.`
            : "O cliente aprovou o orçamento.",

        icon:
          "✓",
      };
    }


    if (
      to ===
      "rejected"
    ) {

      return {
        title:
          "Orçamento reprovado",

        description:
          stringValue(
            data.rejection_reason,
          ) ??
          "O cliente não aprovou o orçamento.",

        icon:
          "×",
      };
    }


    return {
      title:
        "Comercial atualizado",

      description:
        from &&
        to
          ? `${from} → ${to}`
          : "O status comercial foi atualizado.",

      icon:
        "$",
    };
  }


  if (
    action ===
    "supplier.awarded"
  ) {

    return {
      title:
        "Fornecedor escolhido",

      description:
        money(
          data.total_price,
        )
          ? `Proposta selecionada por ${money(
              data.total_price,
            )}.`
          : "Uma proposta foi selecionada para a peça.",

      icon:
        "◇",
    };
  }


  if (
    action ===
    "purchase.created"
  ) {

    return {
      title:
        "Pedido de compra criado",

      description:
        stringValue(
          data.code,
        )
          ? `Pedido ${stringValue(
              data.code,
            )} criado.`
          : "Um novo pedido foi criado.",

      icon:
        "□",
    };
  }


  if (
    action ===
    "purchase.status_changed"
  ) {

    return {
      title:
        "Compra atualizada",

      description:
        from &&
        to
          ? `${from} → ${to}`
          : "O pedido de compra foi atualizado.",

      icon:
        "□",
    };
  }


  if (
    action ===
    "work_order.created"
  ) {

    return {
      title:
        "Ordem de serviço criada",

      description:
        stringValue(
          data.code,
        )
          ? `OS ${stringValue(
              data.code,
            )} criada.`
          : "Uma nova ordem de serviço foi criada.",

      icon:
        "▶",
    };
  }


  if (
    action ===
    "work_order.status_changed"
  ) {

    return {
      title:
        "Execução atualizada",

      description:
        from &&
        to
          ? `${from} → ${to}`
          : "A execução da ordem de serviço mudou.",

      icon:
        "▶",
    };
  }


  if (
    action ===
    "public_link.created"
  ) {

    return {
      title:
        "Link do cliente criado",

      description:
        "O orçamento recebeu um novo link público.",

      icon:
        "↗",
    };
  }


  if (
    action ===
    "public_link.revoked"
  ) {

    return {
      title:
        "Link do cliente revogado",

      description:
        "O acesso público anterior deixou de funcionar.",

      icon:
        "×",
    };
  }


  return {
    title:
      "Atividade registrada",

    description:
      action,

    icon:
      "•",
  };
}


function actorLabel(
  actorType:
    string,

  actorName:
    string | undefined,
): string {

  if (
    actorType ===
    "client"
  ) {

    return "Cliente";
  }


  if (
    actorType ===
    "system"
  ) {

    return "Sistema";
  }


  return (
    actorName ??
    "Usuário"
  );
}


export default async function ActivityPage({
  searchParams,
}: PageProps) {

  const query =
    await searchParams;


  const selectedType =
    (
      query.tipo ??
      "all"
    ).trim();


  const search =
    (
      query.q ??
      ""
    )
      .trim()
      .toLowerCase();


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    data: logsData,
    error: logsError,
  } =
    await supabase
      .from("audit_logs")
      .select(
        "id, actor_user_id, actor_type, action, entity_type, entity_id, quote_id, metadata, created_at",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        500,
      );


  if (
    logsError
  ) {

    throw new Error(
      logsError.message,
    );
  }


  const logs =
    logsData ??
    [];


  const actorIds =
    Array.from(
      new Set(
        logs
          .map(
            (log) =>
              log.actor_user_id,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
    );


  const actorNames =
    new Map<
      string,
      string
    >();


  if (
    actorIds.length >
    0
  ) {

    const {
      data: profiles,
      error: profilesError,
    } =
      await supabase
        .from("profiles")
        .select(
          "user_id, full_name",
        )
        .in(
          "user_id",
          actorIds,
        );


    if (
      profilesError
    ) {

      throw new Error(
        profilesError.message,
      );
    }


    for (
      const profile
      of profiles ??
      []
    ) {

      actorNames.set(
        profile.user_id,
        profile.full_name ||
          "Usuário",
      );
    }
  }


  const quoteIds =
    Array.from(
      new Set(
        logs
          .map(
            (log) =>
              log.quote_id,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
    );


  const quotes =
    new Map<
      string,
      {
        id: string;
        protocol: string;
        customer_id: string;
        vehicle_id: string;
      }
    >();


  if (
    quoteIds.length >
    0
  ) {

    const {
      data,
      error,
    } =
      await supabase
        .from("quotes")
        .select(
          "id, protocol, customer_id, vehicle_id",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "id",
          quoteIds,
        );


    if (error) {

      throw new Error(
        error.message,
      );
    }


    for (
      const quote
      of data ??
      []
    ) {

      quotes.set(
        quote.id,
        quote,
      );
    }
  }


  const customerIds =
    Array.from(
      new Set(
        Array.from(
          quotes.values(),
        ).map(
          (quote) =>
            quote.customer_id,
        ),
      ),
    );


  const vehicleIds =
    Array.from(
      new Set(
        Array.from(
          quotes.values(),
        ).map(
          (quote) =>
            quote.vehicle_id,
        ),
      ),
    );


  const customers =
    new Map<
      string,
      string
    >();


  const vehicles =
    new Map<
      string,
      string
    >();


  if (
    customerIds.length >
    0
  ) {

    const {
      data,
      error,
    } =
      await supabase
        .from("customers")
        .select(
          "id, name",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "id",
          customerIds,
        );


    if (error) {

      throw new Error(
        error.message,
      );
    }


    for (
      const customer
      of data ??
      []
    ) {

      customers.set(
        customer.id,
        customer.name,
      );
    }
  }


  if (
    vehicleIds.length >
    0
  ) {

    const {
      data,
      error,
    } =
      await supabase
        .from("vehicles")
        .select(
          "id, plate",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "id",
          vehicleIds,
        );


    if (error) {

      throw new Error(
        error.message,
      );
    }


    for (
      const vehicle
      of data ??
      []
    ) {

      vehicles.set(
        vehicle.id,
        vehicle.plate,
      );
    }
  }


  const enriched =
    logs.map(
      (log) => {

        const quote =
          log.quote_id
            ? quotes.get(
                log.quote_id,
              )
            : undefined;


        const customer =
          quote
            ? customers.get(
                quote.customer_id,
              )
            : undefined;


        const plate =
          quote
            ? vehicles.get(
                quote.vehicle_id,
              )
            : undefined;


        const actor =
          actorLabel(
            log.actor_type,
            log.actor_user_id
              ? actorNames.get(
                  log.actor_user_id,
                )
              : undefined,
          );


        const data =
          metadata(
            log.metadata,
          );


        const info =
          actionInfo(
            log.action,
            data,
          );


        return {
          log,
          quote,
          customer,
          plate,
          actor,
          data,
          info,
          category:
            actionCategory(
              log.action,
            ),
        };
      },
    );


  const filtered =
    enriched.filter(
      (item) => {

        if (
          selectedType !==
            "all" &&
          item.category !==
            selectedType
        ) {

          return false;
        }


        if (!search) {

          return true;
        }


        const haystack =
          [
            item.info.title,
            item.info.description,
            item.actor,
            item.quote?.protocol,
            item.customer,
            item.plate,
            item.log.action,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        return haystack.includes(
          search,
        );
      },
    );


  const now =
    new Date();


  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );


  const week =
    new Date(
      now,
    );


  week.setDate(
    week.getDate() -
    7,
  );


  const todayCount =
    logs.filter(
      (log) =>
        new Date(
          log.created_at,
        ) >=
        today,
    ).length;


  const weekCount =
    logs.filter(
      (log) =>
        new Date(
          log.created_at,
        ) >=
        week,
    ).length;


  const clientCount =
    logs.filter(
      (log) =>
        log.actor_type ===
        "client",
    ).length;


  const purchaseCount =
    logs.filter(
      (log) =>
        actionCategory(
          log.action,
        ) ===
        "purchase",
    ).length;


  const filters = [
    [
      "all",
      "Tudo",
    ],
    [
      "quote",
      "Orçamentos",
    ],
    [
      "commercial",
      "Comercial",
    ],
    [
      "supplier",
      "Fornecedores",
    ],
    [
      "purchase",
      "Compras",
    ],
    [
      "execution",
      "Execução",
    ],
    [
      "share",
      "Links",
    ],
  ] as const;


  return (
    <div className="orbiq-page activity-page">

      <section className="activity-heading">

        <div>

          <span className="orbiq-eyebrow">
            AUDITORIA
          </span>

          <h1>
            Central de atividades
          </h1>

          <p>
            Uma linha do tempo das principais ações realizadas dentro da oficina.
          </p>

        </div>


        <Link
          href="/dashboard"
          className="orbiq-secondary-button"
        >
          Voltar ao operacional
        </Link>

      </section>


      <section className="activity-metrics">

        <article>

          <span>
            Hoje
          </span>

          <strong>
            {todayCount}
          </strong>

          <small>
            evento(s)
          </small>

        </article>


        <article>

          <span>
            Últimos 7 dias
          </span>

          <strong>
            {weekCount}
          </strong>

          <small>
            evento(s)
          </small>

        </article>


        <article>

          <span>
            Decisões do cliente
          </span>

          <strong>
            {clientCount}
          </strong>

          <small>
            via link público
          </small>

        </article>


        <article>

          <span>
            Eventos de compra
          </span>

          <strong>
            {purchaseCount}
          </strong>

          <small>
            registrados
          </small>

        </article>

      </section>


      <section className="orbiq-panel activity-filter-panel">

        <form
          method="get"
          className="activity-search"
        >

          <input
            type="hidden"
            name="tipo"
            value={
              selectedType
            }
          />


          <input
            type="search"
            name="q"
            defaultValue={
              query.q ??
              ""
            }
            placeholder="Protocolo, cliente, placa, usuário..."
          />


          <button
            type="submit"
            className="orbiq-secondary-button"
          >
            Pesquisar
          </button>

        </form>


        <div className="activity-filters">

          {filters.map(
            ([
              value,
              label,
            ]) => {

              const href =
                value ===
                "all"
                  ? (
                      search
                        ? `/dashboard/atividade?q=${encodeURIComponent(
                            search,
                          )}`
                        : "/dashboard/atividade"
                    )
                  : (
                      `/dashboard/atividade?tipo=${value}${
                        search
                          ? `&q=${encodeURIComponent(
                              search,
                            )}`
                          : ""
                      }`
                    );


              return (
                <Link
                  key={
                    value
                  }
                  href={
                    href
                  }
                  className={
                    `activity-filter${
                      selectedType ===
                      value
                        ? " is-active"
                        : ""
                    }`
                  }
                >
                  {label}
                </Link>
              );
            },
          )}

        </div>

      </section>


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              TIMELINE
            </span>

            <h2>
              Atividades recentes
            </h2>

          </div>


          <span className="orbiq-count-badge">
            {filtered.length}
          </span>

        </div>


        {filtered.length ===
        0 ? (

          <div className="orbiq-empty">

            <strong>
              Nenhuma atividade encontrada.
            </strong>

            <span>
              A auditoria começa a registrar novas ações a partir da Fase 1.6C.
            </span>

          </div>

        ) : (

          <div className="activity-timeline">

            {filtered.map(
              (item) => (

                <article
                  key={
                    item.log.id
                  }
                  className={
                    `activity-event activity-${item.category}`
                  }
                >

                  <div className="activity-event-icon">
                    {item.info.icon}
                  </div>


                  <div className="activity-event-main">

                    <div className="activity-event-title">

                      <strong>
                        {item.info.title}
                      </strong>

                      <span>
                        {dateTime(
                          item.log.created_at,
                        )}
                      </span>

                    </div>


                    <p>
                      {item.info.description}
                    </p>


                    <div className="activity-event-meta">

                      <span>
                        Por:{" "}
                        <strong>
                          {item.actor}
                        </strong>
                      </span>


                      {item.quote ? (

                        <span>
                          Orçamento:{" "}
                          <strong>
                            {item.quote.protocol}
                          </strong>
                        </span>

                      ) : null}


                      {item.customer ? (

                        <span>
                          Cliente:{" "}
                          <strong>
                            {item.customer}
                          </strong>
                        </span>

                      ) : null}


                      {item.plate ? (

                        <span>
                          Placa:{" "}
                          <strong>
                            {item.plate}
                          </strong>
                        </span>

                      ) : null}

                    </div>

                  </div>


                  {item.quote ? (

                    <Link
                      href={
                        `/dashboard/orcamentos/${item.quote.id}`
                      }
                      className="activity-open"
                    >
                      Abrir →
                    </Link>

                  ) : (

                    <span />

                  )}

                </article>

              ),
            )}

          </div>

        )}

      </section>


      <section className="activity-note">

        <strong>
          Auditoria ativa
        </strong>

        <span>
          Eventos anteriores à instalação da Fase 1.6C não são inventados retroativamente. A partir de agora, novas ações passam a compor o histórico.
        </span>

      </section>

    </div>
  );
}