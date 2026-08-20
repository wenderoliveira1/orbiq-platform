import {
  createCustomerAction,
  updateCustomerAction,
} from "./actions";

import { getCurrentContext } from "../_lib/current-organization";

type SearchParams = Promise<{
  q?: string;
  ok?: string;
  error?: string;
}>;

function value(
  value: string | null,
) {
  return value ?? "";
}

export default async function CustomersPage({
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

  const {
    data,
    error,
  } =
    await supabase
      .from("customers")
      .select(
        "id, name, phone, email, notes, created_at",
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
      );

  if (error) {
    throw new Error(
      `Falha ao carregar clientes: ${error.message}`,
    );
  }

  const customers =
    (data ?? []).filter(
      (customer) => {
        if (!q) {
          return true;
        }

        return [
          customer.name,
          customer.phone,
          customer.email,
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
            CLIENTES
          </span>

          <h1>
            Clientes da oficina
          </h1>

          <p>
            Cadastre uma vez e reutilize o cliente
            em veículos, orçamentos e histórico
            de atendimento.
          </p>
        </div>

        <span className="orbiq-count-badge">
          {customers.length} exibidos
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
                Adicionar cliente
              </h2>
            </div>
          </div>

          <form
            action={createCustomerAction}
            className="orbiq-form"
          >
            <label>
              <span>
                Nome e sobrenome *
              </span>

              <input
                name="name"
                required
                minLength={2}
                placeholder="Ex.: João da Silva"
                autoComplete="name"
              />
            </label>

            <div className="orbiq-form-row">
              <label>
                <span>Telefone</span>

                <input
                  name="phone"
                  inputMode="tel"
                  placeholder="(21) 99999-9999"
                  autoComplete="tel"
                />
              </label>

              <label>
                <span>E-mail</span>

                <input
                  name="email"
                  type="email"
                  placeholder="cliente@email.com"
                  autoComplete="email"
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
                placeholder="Informações úteis sobre o cliente..."
              />
            </label>

            <button
              type="submit"
              className="orbiq-primary-button"
            >
              Cadastrar cliente
            </button>
          </form>
        </article>

        <article className="orbiq-panel">
          <div className="orbiq-panel-heading customers-heading">
            <div>
              <span className="orbiq-eyebrow">
                BASE DA OFICINA
              </span>

              <h2>
                Clientes cadastrados
              </h2>
            </div>

            <form
              className="orbiq-search"
              action="/dashboard/clientes"
            >
              <input
                name="q"
                defaultValue={
                  params.q ?? ""
                }
                placeholder="Buscar nome, telefone ou e-mail"
              />

              <button
                type="submit"
                className="orbiq-secondary-button"
              >
                Buscar
              </button>
            </form>
          </div>

          {customers.length === 0 ? (
            <div className="orbiq-empty">
              <strong>
                {q
                  ? "Nenhum cliente encontrado."
                  : "Sua base está vazia."}
              </strong>

              <span>
                {q
                  ? "Tente outro termo de busca."
                  : "Cadastre o primeiro cliente no formulário ao lado."}
              </span>
            </div>
          ) : (
            <div className="orbiq-record-list">
              {customers.map(
                (customer) => (
                  <article
                    className="orbiq-record"
                    key={customer.id}
                  >
                    <div className="orbiq-record-summary">
                      <span className="orbiq-avatar large">
                        {customer.name
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>

                      <div className="orbiq-record-main">
                        <strong>
                          {customer.name}
                        </strong>

                        <div className="orbiq-meta">
                          <span>
                            {customer.phone ||
                              "Sem telefone"}
                          </span>

                          <span>
                            {customer.email ||
                              "Sem e-mail"}
                          </span>
                        </div>
                      </div>

                      <details className="orbiq-details">
                        <summary>
                          Editar
                        </summary>

                        <form
                          action={updateCustomerAction}
                          className="orbiq-form edit-form"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              customer.id
                            }
                          />

                          <label>
                            <span>
                              Nome e sobrenome *
                            </span>

                            <input
                              name="name"
                              required
                              minLength={2}
                              defaultValue={
                                customer.name
                              }
                            />
                          </label>

                          <div className="orbiq-form-row">
                            <label>
                              <span>
                                Telefone
                              </span>

                              <input
                                name="phone"
                                defaultValue={
                                  value(
                                    customer.phone,
                                  )
                                }
                              />
                            </label>

                            <label>
                              <span>
                                E-mail
                              </span>

                              <input
                                name="email"
                                type="email"
                                defaultValue={
                                  value(
                                    customer.email,
                                  )
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
                                value(
                                  customer.notes,
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

                    {customer.notes ? (
                      <p className="orbiq-record-note">
                        {customer.notes}
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