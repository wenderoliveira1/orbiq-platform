import {
  createVehicleAction,
  updateVehicleAction,
} from "./actions";

import { getCurrentContext } from "../_lib/current-organization";

type SearchParams = Promise<{
  q?: string;
  ok?: string;
  error?: string;
}>;

function optional(
  value: string | null,
) {
  return value ?? "";
}

function formatMileage(
  value: number | null,
) {
  if (value === null) {
    return "KM não informado";
  }

  return `${new Intl.NumberFormat(
    "pt-BR",
  ).format(value)} km`;
}

export default async function VehiclesPage({
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

  const {
    supabase,
    organization,
  } = await getCurrentContext();

  const [
    customersResult,
    vehiclesResult,
  ] =
    await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, name",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .order(
          "name",
          {
            ascending: true,
          },
        ),

      supabase
        .from("vehicles")
        .select(
          "id, customer_id, plate, brand, model, version, model_year, mileage, notes, created_at",
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
        ),
    ]);

  if (
    customersResult.error
  ) {
    throw new Error(
      `Falha ao carregar clientes: ${customersResult.error.message}`,
    );
  }

  if (
    vehiclesResult.error
  ) {
    throw new Error(
      `Falha ao carregar veículos: ${vehiclesResult.error.message}`,
    );
  }

  const customers =
    customersResult.data ?? [];

  const customerMap =
    new Map(
      customers.map(
        (customer) => [
          customer.id,
          customer.name,
        ],
      ),
    );

  const vehicles =
    (vehiclesResult.data ?? []).filter(
      (vehicle) => {
        if (!q) {
          return true;
        }

        const owner =
          vehicle.customer_id
            ? customerMap.get(
                vehicle.customer_id,
              ) ?? ""
            : "";

        return [
          vehicle.plate,
          vehicle.brand,
          vehicle.model,
          vehicle.version,
          owner,
        ]
          .filter(Boolean)
          .some(
            (item) =>
              String(item)
                .toLocaleLowerCase(
                  "pt-BR",
                )
                .includes(q),
          );
      },
    );

  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">
            VEÍCULOS
          </span>

          <h1>
            Veículos da oficina
          </h1>

          <p>
            Cada veículo fica ligado ao cliente certo
            e poderá ser reutilizado diretamente
            nos próximos orçamentos.
          </p>
        </div>

        <span className="orbiq-count-badge">
          {vehicles.length} exibidos
        </span>
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

      <section className="orbiq-grid-form">
        <article className="orbiq-panel sticky-panel">
          <div className="orbiq-panel-heading">
            <div>
              <span className="orbiq-eyebrow">
                NOVO CADASTRO
              </span>

              <h2>
                Adicionar veículo
              </h2>
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="orbiq-empty compact">
              <strong>
                Cadastre um cliente primeiro.
              </strong>

              <span>
                O Orbiq precisa saber quem é o
                proprietário antes de registrar
                o veículo.
              </span>

              <a
                href="/dashboard/clientes"
                className="orbiq-primary-button"
              >
                Ir para clientes
              </a>
            </div>
          ) : (
            <form
              action={createVehicleAction}
              className="orbiq-form"
            >
              <label>
                <span>
                  Cliente proprietário *
                </span>

                <select
                  name="customer_id"
                  required
                  defaultValue=""
                >
                  <option
                    value=""
                    disabled
                  >
                    Selecione o cliente
                  </option>

                  {customers.map(
                    (customer) => (
                      <option
                        key={
                          customer.id
                        }
                        value={
                          customer.id
                        }
                      >
                        {customer.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="orbiq-form-row">
                <label>
                  <span>
                    Placa *
                  </span>

                  <input
                    name="plate"
                    required
                    maxLength={8}
                    placeholder="ABC1D23"
                    autoCapitalize="characters"
                  />
                </label>

                <label>
                  <span>Marca</span>

                  <input
                    name="brand"
                    placeholder="Ex.: Volkswagen"
                  />
                </label>
              </div>

              <div className="orbiq-form-row">
                <label>
                  <span>
                    Modelo *
                  </span>

                  <input
                    name="model"
                    required
                    placeholder="Ex.: T-Cross"
                  />
                </label>

                <label>
                  <span>
                    Versão
                  </span>

                  <input
                    name="version"
                    placeholder="Ex.: Comfortline 1.0 TSI"
                  />
                </label>
              </div>

              <div className="orbiq-form-row">
                <label>
                  <span>
                    Ano modelo
                  </span>

                  <input
                    name="model_year"
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="2024"
                  />
                </label>

                <label>
                  <span>
                    Quilometragem
                  </span>

                  <input
                    name="mileage"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="45000"
                  />
                </label>
              </div>

              <label>
                <span>
                  Observações
                </span>

                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Informações úteis sobre o veículo..."
                />
              </label>

              <button
                type="submit"
                className="orbiq-primary-button"
              >
                Cadastrar veículo
              </button>
            </form>
          )}
        </article>

        <article className="orbiq-panel">
          <div className="orbiq-panel-heading customers-heading">
            <div>
              <span className="orbiq-eyebrow">
                FROTA ATENDIDA
              </span>

              <h2>
                Veículos cadastrados
              </h2>
            </div>

            <form
              className="orbiq-search"
              action="/dashboard/veiculos"
            >
              <input
                name="q"
                defaultValue={
                  params.q ?? ""
                }
                placeholder="Buscar placa, modelo ou cliente"
              />

              <button
                type="submit"
                className="orbiq-secondary-button"
              >
                Buscar
              </button>
            </form>
          </div>

          {vehicles.length === 0 ? (
            <div className="orbiq-empty">
              <strong>
                {q
                  ? "Nenhum veículo encontrado."
                  : "Nenhum veículo cadastrado."}
              </strong>

              <span>
                {q
                  ? "Tente outro termo de busca."
                  : "Cadastre o primeiro veículo no formulário ao lado."}
              </span>
            </div>
          ) : (
            <div className="orbiq-record-list">
              {vehicles.map(
                (vehicle) => (
                  <article
                    className="orbiq-record"
                    key={vehicle.id}
                  >
                    <div className="orbiq-record-summary">
                      <span className="orbiq-plate">
                        {vehicle.plate}
                      </span>

                      <div className="orbiq-record-main">
                        <strong>
                          {[
                            vehicle.brand,
                            vehicle.model,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </strong>

                        <div className="orbiq-meta">
                          <span>
                            {vehicle.customer_id
                              ? customerMap.get(
                                  vehicle.customer_id,
                                ) ??
                                "Cliente não localizado"
                              : "Sem cliente"}
                          </span>

                          <span>
                            {formatMileage(
                              vehicle.mileage,
                            )}
                          </span>

                          {vehicle.model_year ? (
                            <span>
                              Ano {
                                vehicle.model_year
                              }
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <details className="orbiq-details">
                        <summary>
                          Editar
                        </summary>

                        <form
                          action={updateVehicleAction}
                          className="orbiq-form edit-form"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              vehicle.id
                            }
                          />

                          <label>
                            <span>
                              Cliente proprietário *
                            </span>

                            <select
                              name="customer_id"
                              required
                              defaultValue={
                                vehicle.customer_id ??
                                ""
                              }
                            >
                              <option
                                value=""
                                disabled
                              >
                                Selecione o cliente
                              </option>

                              {customers.map(
                                (customer) => (
                                  <option
                                    key={
                                      customer.id
                                    }
                                    value={
                                      customer.id
                                    }
                                  >
                                    {
                                      customer.name
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <div className="orbiq-form-row">
                            <label>
                              <span>
                                Placa *
                              </span>

                              <input
                                name="plate"
                                required
                                defaultValue={
                                  vehicle.plate
                                }
                              />
                            </label>

                            <label>
                              <span>
                                Marca
                              </span>

                              <input
                                name="brand"
                                defaultValue={
                                  optional(
                                    vehicle.brand,
                                  )
                                }
                              />
                            </label>
                          </div>

                          <div className="orbiq-form-row">
                            <label>
                              <span>
                                Modelo *
                              </span>

                              <input
                                name="model"
                                required
                                defaultValue={
                                  vehicle.model
                                }
                              />
                            </label>

                            <label>
                              <span>
                                Versão
                              </span>

                              <input
                                name="version"
                                defaultValue={
                                  optional(
                                    vehicle.version,
                                  )
                                }
                              />
                            </label>
                          </div>

                          <div className="orbiq-form-row">
                            <label>
                              <span>
                                Ano modelo
                              </span>

                              <input
                                name="model_year"
                                type="number"
                                min="1900"
                                max="2100"
                                defaultValue={
                                  vehicle.model_year ??
                                  ""
                                }
                              />
                            </label>

                            <label>
                              <span>
                                Quilometragem
                              </span>

                              <input
                                name="mileage"
                                type="number"
                                min="0"
                                defaultValue={
                                  vehicle.mileage ??
                                  ""
                                }
                              />
                            </label>
                          </div>

                          <label>
                            <span>
                              Observações
                            </span>

                            <textarea
                              name="notes"
                              rows={3}
                              defaultValue={
                                optional(
                                  vehicle.notes,
                                )
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
                    </div>

                    {vehicle.notes ? (
                      <p className="orbiq-record-note">
                        {vehicle.notes}
                      </p>
                    ) : null}
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