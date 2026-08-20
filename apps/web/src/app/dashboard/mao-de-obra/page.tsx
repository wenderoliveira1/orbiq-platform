import {
  getCurrentContext,
} from "../_lib/current-organization";

import {
  saveLaborServiceAction,
  toggleLaborServiceAction,
} from "./actions";


type SearchParams =
  Promise<{
    q?: string;
    ok?: string;
    error?: string;
    status?: string;
  }>;


function currency(
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


export default async function LaborPage({
  searchParams,
}: {
  searchParams:
    SearchParams;
}) {

  const params =
    await searchParams;


  const q =
    String(
      params.q ??
        "",
    )
      .trim()
      .toLocaleLowerCase(
        "pt-BR",
      );


  const status =
    String(
      params.status ??
        "all",
    );


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "labor_services",
      )
      .select(
        "id, description, category, amount, notes, active, created_at, updated_at",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .order(
        "active",
        {
          ascending:
            false,
        },
      )
      .order(
        "description",
        {
          ascending:
            true,
        },
      );


  if (error) {

    throw new Error(
      `Falha ao carregar mão de obra: ${error.message}`,
    );
  }


  const allServices =
    data ??
    [];


  const services =
    allServices.filter(
      (service) => {

        if (
          status ===
            "active" &&
          !service.active
        ) {

          return false;
        }


        if (
          status ===
            "inactive" &&
          service.active
        ) {

          return false;
        }


        if (!q) {

          return true;
        }


        return [
          service.description,
          service.category,
          service.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(
            "pt-BR",
          )
          .includes(
            q,
          );
      },
    );


  const activeCount =
    allServices.filter(
      (service) =>
        service.active,
    ).length;


  const inactiveCount =
    allServices.length -
    activeCount;


  return (
    <div className="orbiq-page">

      <section className="orbiq-page-heading">

        <div>

          <span className="orbiq-eyebrow">
            MÃO DE OBRA
          </span>

          <h1>
            Serviços e valores
          </h1>

          <p>
            Cadastre somente os serviços realizados pela sua oficina. Nada é preenchido automaticamente.
          </p>

        </div>


        <div className="labor-heading-metrics">

          <span>

            <strong>
              {activeCount}
            </strong>

            ativos

          </span>


          <span>

            <strong>
              {inactiveCount}
            </strong>

            inativos

          </span>

        </div>

      </section>


      {params.ok ? (

        <div className="orbiq-alert success">
          {params.ok}
        </div>

      ) : null}


      {params.error ? (

        <div className="orbiq-alert error">
          {params.error}
        </div>

      ) : null}


      <section className="labor-layout">

        <article className="orbiq-panel labor-new-panel">

          <div className="orbiq-panel-heading">

            <div>

              <span className="orbiq-eyebrow">
                ADICIONAR
              </span>

              <h2>
                Nova mão de obra
              </h2>

            </div>

          </div>


          <form
            action={
              saveLaborServiceAction
            }
            className="orbiq-form"
          >

            <label>

              <span>
                Serviço *
              </span>

              <input
                name="description"
                required
                minLength={2}
                autoComplete="off"
                placeholder="Ex.: Trocar coxim do motor"
              />

            </label>


            <label>

              <span>
                Categoria
              </span>

              <input
                name="category"
                autoComplete="off"
                placeholder="Ex.: Mecânica geral"
              />

            </label>


            <label>

              <span>
                Valor da mão de obra *
              </span>

              <div className="labor-money-input">

                <span>
                  R$
                </span>

                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                />

              </div>

            </label>


            <label>

              <span>
                Observação
              </span>

              <textarea
                name="notes"
                rows={3}
                placeholder="Opcional"
              />

            </label>


            <button
              type="submit"
              className="orbiq-primary-button"
            >
              + Adicionar mão de obra
            </button>

          </form>

        </article>


        <article className="orbiq-panel labor-list-panel">

          <div className="labor-list-heading">

            <div>

              <span className="orbiq-eyebrow">
                CADASTRADOS
              </span>

              <h2>
                Tabela de mão de obra
              </h2>

            </div>


            <form
              action="/dashboard/mao-de-obra"
              className="labor-search"
            >

              <input
                name="q"
                defaultValue={
                  params.q ??
                  ""
                }
                placeholder="Buscar serviço"
              />


              <select
                name="status"
                defaultValue={
                  status
                }
              >

                <option value="all">
                  Todos
                </option>

                <option value="active">
                  Ativos
                </option>

                <option value="inactive">
                  Inativos
                </option>

              </select>


              <button
                type="submit"
                className="orbiq-secondary-button"
              >
                Buscar
              </button>

            </form>

          </div>


          {services.length ===
          0 ? (

            <div className="labor-empty">

              <div>
                +
              </div>

              <strong>
                {allServices.length ===
                0
                  ? "Sua tabela está vazia."
                  : "Nenhum serviço encontrado."}
              </strong>

              <span>
                {allServices.length ===
                0
                  ? "Cadastre acima somente as mãos de obra que sua oficina utiliza."
                  : "Altere a busca ou os filtros."}
              </span>

            </div>

          ) : (

            <div className="labor-service-list">

              {services.map(
                (service) => (

                  <article
                    key={
                      service.id
                    }
                    className={
                      `labor-service-row${
                        service.active
                          ? ""
                          : " inactive"
                      }`
                    }
                  >

                    <div className="labor-service-main">

                      <div>

                        <strong>
                          {service.description}
                        </strong>

                        <span>
                          {service.category ??
                            "Sem categoria"}
                        </span>

                      </div>


                      <strong className="labor-price">
                        {currency(
                          service.amount,
                        )}
                      </strong>

                    </div>


                    {service.notes ? (

                      <p>
                        {service.notes}
                      </p>

                    ) : null}


                    <div className="labor-service-actions">

                      <details>

                        <summary>
                          Editar
                        </summary>


                        <form
                          action={
                            saveLaborServiceAction
                          }
                          className="labor-edit-form"
                        >

                          <input
                            type="hidden"
                            name="service_id"
                            value={
                              service.id
                            }
                          />


                          <div className="labor-edit-grid">

                            <label>

                              <span>
                                Serviço
                              </span>

                              <input
                                name="description"
                                required
                                defaultValue={
                                  service.description
                                }
                              />

                            </label>


                            <label>

                              <span>
                                Categoria
                              </span>

                              <input
                                name="category"
                                defaultValue={
                                  service.category ??
                                  ""
                                }
                              />

                            </label>


                            <label>

                              <span>
                                Valor
                              </span>

                              <input
                                name="amount"
                                required
                                inputMode="decimal"
                                defaultValue={
                                  service.amount
                                }
                              />

                            </label>

                          </div>


                          <label>

                            <span>
                              Observação
                            </span>

                            <textarea
                              name="notes"
                              rows={2}
                              defaultValue={
                                service.notes ??
                                ""
                              }
                            />

                          </label>


                          <button
                            type="submit"
                            className="orbiq-primary-button"
                          >
                            Salvar alterações
                          </button>

                        </form>

                      </details>


                      <form
                        action={
                          toggleLaborServiceAction
                        }
                      >

                        <input
                          type="hidden"
                          name="service_id"
                          value={
                            service.id
                          }
                        />

                        <input
                          type="hidden"
                          name="target_active"
                          value={
                            service.active
                              ? "false"
                              : "true"
                          }
                        />


                        <button
                          type="submit"
                          className="orbiq-secondary-button"
                        >
                          {service.active
                            ? "Desativar"
                            : "Ativar"}
                        </button>

                      </form>

                    </div>

                  </article>
                ),
              )}

            </div>

          )}

        </article>

      </section>

    </div>
  );
}