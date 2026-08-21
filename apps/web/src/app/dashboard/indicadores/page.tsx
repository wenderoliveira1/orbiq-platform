import Link from "next/link";

import {
  getCurrentContext,
} from "../_lib/current-organization";


type QuoteRow = {
  id: string;
  created_by: string | null;
  created_at: string;
  commercial_status: string;
  final_amount: number | null;
};


type RankingRow = {
  userId: string;
  name: string;
  total: number;
  approved: number;
  rejected: number;
  awaiting: number;
  approvedAmount: number;
  conversion: number;
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


function number(
  value:
    number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
  ).format(
    value,
  );
}


function percentage(
  value:
    number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits:
        1,

      maximumFractionDigits:
        1,
    },
  ).format(
    value,
  ) + "%";
}


function startOfWeek(
  source:
    Date,
): Date {

  const date =
    new Date(
      source,
    );


  date.setHours(
    0,
    0,
    0,
    0,
  );


  const day =
    date.getDay();


  const difference =
    day ===
    0
      ? -6
      : 1 -
        day;


  date.setDate(
    date.getDate() +
    difference,
  );


  return date;
}


function buildRanking(
  rows:
    QuoteRow[],

  names:
    Map<string, string>,
): RankingRow[] {

  const ranking =
    new Map<
      string,
      RankingRow
    >();


  for (
    const quote
    of rows
  ) {

    const userId =
      quote.created_by ??
      "without-user";


    const fallback =
      userId ===
      "without-user"
        ? "Sem responsável"
        : `Atendente ${userId.slice(
            0,
            8,
          )}`;


    const current =
      ranking.get(
        userId,
      ) ?? {
        userId,

        name:
          names.get(
            userId,
          ) ??
          fallback,

        total:
          0,

        approved:
          0,

        rejected:
          0,

        awaiting:
          0,

        approvedAmount:
          0,

        conversion:
          0,
      };


    current.total +=
      1;


    if (
      quote.commercial_status ===
      "approved"
    ) {

      current.approved +=
        1;


      current.approvedAmount +=
        quote.final_amount ??
        0;
    }
    else if (
      quote.commercial_status ===
      "rejected"
    ) {

      current.rejected +=
        1;
    }
    else if (
      quote.commercial_status ===
      "ready"
    ) {

      current.awaiting +=
        1;
    }


    ranking.set(
      userId,
      current,
    );
  }


  const result =
    Array.from(
      ranking.values(),
    );


  for (
    const item
    of result
  ) {

    const decisions =
      item.approved +
      item.rejected;


    item.conversion =
      decisions >
      0
        ? (
            item.approved /
            decisions
          ) *
          100
        : 0;
  }


  return result.sort(
    (
      first,
      second,
    ) =>
      second.total -
        first.total ||
      second.approved -
        first.approved ||
      second.approvedAmount -
        first.approvedAmount,
  );
}


function Ranking({
  title,
  eyebrow,
  rows,
}: {
  title: string;
  eyebrow: string;
  rows: RankingRow[];
}) {

  return (
    <article className="orbiq-panel analytics-ranking-panel">

      <div className="orbiq-panel-heading">

        <div>

          <span className="orbiq-eyebrow">
            {eyebrow}
          </span>

          <h2>
            {title}
          </h2>

        </div>

      </div>


      {rows.length ===
      0 ? (

        <div className="orbiq-empty compact">

          <strong>
            Nenhum orçamento no período.
          </strong>

          <span>
            O ranking aparecerá automaticamente quando novos atendimentos forem criados.
          </span>

        </div>

      ) : (

        <div className="analytics-ranking-list">

          {rows.map(
            (
              row,
              index,
            ) => (

              <div
                key={
                  row.userId
                }
                className="analytics-ranking-row"
              >

                <span
                  className={
                    `analytics-rank-position rank-${index + 1}`
                  }
                >
                  {index +
                    1}
                </span>


                <div className="analytics-ranking-person">

                  <strong>
                    {row.name}
                  </strong>

                  <span>
                    {row.approved} aprovado(s) · {row.awaiting} aguardando
                  </span>

                </div>


                <div>

                  <span>
                    Orçamentos
                  </span>

                  <strong>
                    {row.total}
                  </strong>

                </div>


                <div>

                  <span>
                    Conversão
                  </span>

                  <strong>
                    {percentage(
                      row.conversion,
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    Valor aprovado
                  </span>

                  <strong>
                    {money(
                      row.approvedAmount,
                    )}
                  </strong>

                </div>

              </div>

            ),
          )}

        </div>

      )}

    </article>
  );
}


export default async function IndicatorsPage() {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const now =
    new Date();


  const weekStart =
    startOfWeek(
      now,
    );


  const monthStart =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );


  const periodStart =
    weekStart <
    monthStart
      ? weekStart
      : monthStart;


  const {
    data: quoteData,
    error: quotesError,
  } =
    await supabase
      .from("quotes")
      .select(
        "id, created_by, created_at, commercial_status, final_amount",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .gte(
        "created_at",
        periodStart.toISOString(),
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        2500,
      );


  if (
    quotesError
  ) {

    throw new Error(
      quotesError.message,
    );
  }


  const quotes =
    (
      quoteData ??
      []
    ) as QuoteRow[];


  const creatorIds =
    Array.from(
      new Set(
        quotes
          .map(
            (quote) =>
              quote.created_by,
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


  const profileNames =
    new Map<
      string,
      string
    >();


  if (
    creatorIds.length >
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
          creatorIds,
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

      if (
        profile.full_name
      ) {

        profileNames.set(
          profile.user_id,
          profile.full_name,
        );
      }
    }
  }


  const weekQuotes =
    quotes.filter(
      (quote) =>
        new Date(
          quote.created_at,
        ) >=
        weekStart,
    );


  const monthQuotes =
    quotes.filter(
      (quote) =>
        new Date(
          quote.created_at,
        ) >=
        monthStart,
    );


  const approved =
    monthQuotes.filter(
      (quote) =>
        quote.commercial_status ===
        "approved",
    );


  const rejected =
    monthQuotes.filter(
      (quote) =>
        quote.commercial_status ===
        "rejected",
    );


  const waiting =
    monthQuotes.filter(
      (quote) =>
        quote.commercial_status ===
        "ready",
    );


  const draft =
    monthQuotes.filter(
      (quote) =>
        quote.commercial_status ===
        "draft",
    );


  const decisions =
    approved.length +
    rejected.length;


  const approvalRate =
    decisions >
    0
      ? (
          approved.length /
          decisions
        ) *
        100
      : 0;


  const approvedValue =
    approved.reduce(
      (
        total,
        quote,
      ) =>
        total +
        (
          quote.final_amount ??
          0
        ),
      0,
    );


  const approvedWithValue =
    approved.filter(
      (quote) =>
        quote.final_amount !==
        null,
    );


  const averageTicket =
    approvedWithValue.length >
    0
      ? approvedValue /
        approvedWithValue.length
      : 0;


  const weekRanking =
    buildRanking(
      weekQuotes,
      profileNames,
    );


  const monthRanking =
    buildRanking(
      monthQuotes,
      profileNames,
    );


  const topPerformer =
    monthRanking[
      0
    ] ??
    null;


  const funnel = [
    {
      label:
        "Em elaboração",

      value:
        draft.length,

      className:
        "draft",
    },
    {
      label:
        "Aguardando cliente",

      value:
        waiting.length,

      className:
        "waiting",
    },
    {
      label:
        "Aprovados",

      value:
        approved.length,

      className:
        "approved",
    },
    {
      label:
        "Reprovados",

      value:
        rejected.length,

      className:
        "rejected",
    },
  ];


  const maxFunnel =
    Math.max(
      1,
      ...funnel.map(
        (item) =>
          item.value,
      ),
    );


  const monthLabel =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        month:
          "long",

        year:
          "numeric",
      },
    ).format(
      now,
    );


  return (
    <div className="orbiq-page analytics-page">

      <section className="analytics-heading">

        <div>

          <span className="orbiq-eyebrow">
            INDICADORES
          </span>

          <h1>
            Performance da oficina
          </h1>

          <p>
            Acompanhe produção, conversão e desempenho comercial em tempo real.
          </p>

        </div>


        <div className="analytics-heading-actions">

          <span className="analytics-period">
            {monthLabel}
          </span>


          <Link
            href="/dashboard"
            className="orbiq-secondary-button"
          >
            Voltar ao operacional
          </Link>

        </div>

      </section>


      <section className="analytics-kpi-grid">

        <article>

          <span>
            Orçamentos no mês
          </span>

          <strong>
            {number(
              monthQuotes.length,
            )}
          </strong>

          <small>
            {number(
              weekQuotes.length,
            )} nesta semana
          </small>

        </article>


        <article>

          <span>
            Taxa de aprovação
          </span>

          <strong>
            {percentage(
              approvalRate,
            )}
          </strong>

          <small>
            {approved.length} aprovados · {rejected.length} reprovados
          </small>

        </article>


        <article>

          <span>
            Ticket médio aprovado
          </span>

          <strong>
            {money(
              averageTicket,
            )}
          </strong>

          <small>
            somente orçamentos aprovados
          </small>

        </article>


        <article className="analytics-kpi-highlight">

          <span>
            Valor aprovado no mês
          </span>

          <strong>
            {money(
              approvedValue,
            )}
          </strong>

          <small>
            valor comercial aprovado
          </small>

        </article>

      </section>


      <section className="analytics-secondary-grid">

        <article className="orbiq-panel analytics-funnel-panel">

          <div className="orbiq-panel-heading">

            <div>

              <span className="orbiq-eyebrow">
                COMERCIAL
              </span>

              <h2>
                Funil do mês
              </h2>

            </div>

          </div>


          <div className="analytics-funnel">

            {funnel.map(
              (item) => {

                const width =
                  (
                    item.value /
                    maxFunnel
                  ) *
                  100;


                return (
                  <div
                    key={
                      item.label
                    }
                    className="analytics-funnel-row"
                  >

                    <div>

                      <strong>
                        {item.label}
                      </strong>

                      <span>
                        {item.value}
                      </span>

                    </div>


                    <div className="analytics-meter">

                      <span
                        className={
                          `analytics-meter-fill funnel-${item.className}`
                        }
                        style={{
                          width:
                            `${width}%`,
                        }}
                      />

                    </div>

                  </div>
                );
              },
            )}

          </div>

        </article>


        <article className="orbiq-panel analytics-leader-panel">

          <span className="orbiq-eyebrow">
            DESTAQUE DO MÊS
          </span>


          {topPerformer ? (

            <>

              <div className="analytics-leader-icon">
                ★
              </div>


              <h2>
                {topPerformer.name}
              </h2>


              <strong>
                {topPerformer.total}
              </strong>

              <span>
                orçamento(s) criado(s)
              </span>


              <div className="analytics-leader-stats">

                <div>

                  <span>
                    Aprovados
                  </span>

                  <strong>
                    {topPerformer.approved}
                  </strong>

                </div>


                <div>

                  <span>
                    Conversão
                  </span>

                  <strong>
                    {percentage(
                      topPerformer.conversion,
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    Valor
                  </span>

                  <strong>
                    {money(
                      topPerformer.approvedAmount,
                    )}
                  </strong>

                </div>

              </div>

            </>

          ) : (

            <div className="analytics-no-leader">

              <strong>
                Ainda sem ranking.
              </strong>

              <span>
                Crie orçamentos para iniciar os indicadores.
              </span>

            </div>

          )}

        </article>

      </section>


      <section className="analytics-ranking-grid">

        <Ranking
          eyebrow="SEMANA"
          title="Quem mais criou orçamentos"
          rows={
            weekRanking
          }
        />


        <Ranking
          eyebrow="MÊS"
          title="Ranking mensal"
          rows={
            monthRanking
          }
        />

      </section>


      <section className="analytics-footer-grid">

        <Link
          href="/dashboard/orcamentos"
          className="analytics-shortcut"
        >

          <span>
            ▤
          </span>

          <div>

            <strong>
              Histórico de orçamentos
            </strong>

            <small>
              Consulte cada atendimento.
            </small>

          </div>

          <b>
            →
          </b>

        </Link>


        <Link
          href="/dashboard/comercial"
          className="analytics-shortcut"
        >

          <span>
            $
          </span>

          <div>

            <strong>
              Comercial
            </strong>

            <small>
              Acompanhe decisões pendentes.
            </small>

          </div>

          <b>
            →
          </b>

        </Link>


        <Link
          href="/dashboard/orcamentos/novo"
          className="analytics-shortcut"
        >

          <span>
            +
          </span>

          <div>

            <strong>
              Novo orçamento
            </strong>

            <small>
              Inicie um novo atendimento.
            </small>

          </div>

          <b>
            →
          </b>

        </Link>

      </section>

    </div>
  );
}