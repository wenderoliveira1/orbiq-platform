import {
  getCurrentContext,
} from "../_lib/current-organization";

import {
  saveSupplierAction,
  toggleSupplierAction,
} from "./actions";


type SearchParams =
  Promise<{
    q?: string;
    ok?: string;
    error?: string;
  }>;


function formatWhatsapp(
  value:
    string |
    null,
): string {
  if (!value) {
    return "Sem WhatsApp";
  }

  return (
    "+" +
    value
  );
}


export default async function SuppliersPage({
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


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const [
    categoriesResult,
    suppliersResult,
    linksResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "supplier_categories",
        )
        .select(
          "id, name, active",
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
        .from(
          "suppliers",
        )
        .select(
          "id, name, whatsapp, active, notes, created_at",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .order(
          "active",
          {
            ascending: false,
          },
        )
        .order(
          "name",
          {
            ascending: true,
          },
        ),

      supabase
        .from(
          "supplier_category_links",
        )
        .select(
          "supplier_id, category_id",
        )
        .eq(
          "organization_id",
          organization.id,
        ),
    ]);


  if (
    categoriesResult.error
  ) {
    throw new Error(
      `Falha ao carregar categorias: ${categoriesResult.error.message}`,
    );
  }


  if (
    suppliersResult.error
  ) {
    throw new Error(
      `Falha ao carregar fornecedores: ${suppliersResult.error.message}`,
    );
  }


  if (
    linksResult.error
  ) {
    throw new Error(
      `Falha ao carregar vínculos: ${linksResult.error.message}`,
    );
  }


  const categories =
    (
      categoriesResult.data ??
      []
    ).filter(
      (category) =>
        category.active,
    );


  const categoryMap =
    new Map(
      categories.map(
        (category) =>
          [
            category.id,
            category.name,
          ] as const,
      ),
    );


  const linksBySupplier =
    new Map<
      string,
      string[]
    >();


  for (
    const link
    of linksResult.data ??
    []
  ) {
    const current =
      linksBySupplier.get(
        link.supplier_id,
      ) ??
      [];

    current.push(
      link.category_id,
    );

    linksBySupplier.set(
      link.supplier_id,
      current,
    );
  }


  const allSuppliers =
    suppliersResult.data ??
    [];


  const suppliers =
    allSuppliers.filter(
      (supplier) => {
        if (!q) {
          return true;
        }


        const supplierCategories =
          (
            linksBySupplier.get(
              supplier.id,
            ) ??
            []
          )
            .map(
              (id) =>
                categoryMap.get(
                  id,
                ) ??
                "",
            )
            .join(" ");


        return [
          supplier.name,
          supplier.whatsapp,
          supplier.notes,
          supplierCategories,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(
            "pt-BR",
          )
          .includes(q);
      },
    );


  const activeCount =
    allSuppliers.filter(
      (supplier) =>
        supplier.active,
    ).length;


  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">
            FORNECEDORES
          </span>

          <h1>
            Rede de compras
          </h1>

          <p>
            Organize cada fornecedor pelas categorias que ele atende. O Orbiq usará esses vínculos automaticamente nas cotações.
          </p>
        </div>

        <div className="supplier-heading-stats">
          <span>
            <strong>
              {activeCount}
            </strong>

            ativos
          </span>

          <span>
            <strong>
              {allSuppliers.length}
            </strong>

            total
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


      <section className="orbiq-grid-form">
        <article className="orbiq-panel sticky-panel">
          <div className="orbiq-panel-heading">
            <div>
              <span className="orbiq-eyebrow">
                NOVO FORNECEDOR
              </span>

              <h2>
                Cadastro rápido
              </h2>
            </div>
          </div>


          <form
            action={
              saveSupplierAction
            }
            className="orbiq-form"
          >
            <label>
              <span>
                Fornecedor *
              </span>

              <input
                name="name"
                required
                minLength={2}
                placeholder="Nome do fornecedor"
              />
            </label>


            <label>
              <span>
                WhatsApp
              </span>

              <input
                name="whatsapp"
                inputMode="tel"
                placeholder="5521999999999"
              />
            </label>


            <div className="supplier-category-field">
              <span className="supplier-field-label">
                Categorias *
              </span>

              <div className="supplier-category-grid">
                {categories.map(
                  (category) => (
                    <label
                      key={
                        category.id
                      }
                    >
                      <input
                        type="checkbox"
                        name="category_ids"
                        value={
                          category.id
                        }
                      />

                      <span>
                        {
                          category.name
                        }
                      </span>
                    </label>
                  ),
                )}
              </div>
            </div>


            <label>
              <span>
                Observações
              </span>

              <textarea
                name="notes"
                rows={3}
                placeholder="Ex.: entrega rápida, peças originais..."
              />
            </label>


            <button
              type="submit"
              className="orbiq-primary-button"
            >
              Cadastrar fornecedor
            </button>
          </form>
        </article>


        <article className="orbiq-panel">
          <div className="orbiq-panel-heading supplier-list-heading">
            <div>
              <span className="orbiq-eyebrow">
                REDE CADASTRADA
              </span>

              <h2>
                Fornecedores
              </h2>
            </div>


            <form
              action="/dashboard/fornecedores"
              className="orbiq-search"
            >
              <input
                name="q"
                defaultValue={
                  params.q ??
                  ""
                }
                placeholder="Buscar fornecedor ou categoria"
              />

              <button
                type="submit"
                className="orbiq-secondary-button"
              >
                Buscar
              </button>
            </form>
          </div>


          {suppliers.length ===
          0 ? (
            <div className="orbiq-empty">
              <strong>
                {q
                  ? "Nenhum fornecedor encontrado."
                  : "Nenhum fornecedor cadastrado."}
              </strong>

              <span>
                {q
                  ? "Tente outra busca."
                  : "Cadastre o primeiro fornecedor no formulário ao lado."}
              </span>
            </div>
          ) : (
            <div className="supplier-list">
              {suppliers.map(
                (supplier) => {
                  const selectedIds =
                    linksBySupplier.get(
                      supplier.id,
                    ) ??
                    [];


                  const selectedCategories =
                    selectedIds
                      .map(
                        (id) =>
                          categoryMap.get(
                            id,
                          ),
                      )
                      .filter(
                        (
                          value,
                        ): value is string =>
                          Boolean(
                            value,
                          ),
                      );


                  return (
                    <article
                      className={
                        `supplier-card${
                          supplier.active
                            ? ""
                            : " inactive"
                        }`
                      }
                      key={
                        supplier.id
                      }
                    >
                      <div className="supplier-summary">
                        <span className="supplier-avatar">
                          {
                            supplier.name
                              .slice(
                                0,
                                1,
                              )
                              .toUpperCase()
                          }
                        </span>


                        <div className="supplier-main">
                          <div className="supplier-title-row">
                            <strong>
                              {
                                supplier.name
                              }
                            </strong>

                            <span
                              className={
                                supplier.active
                                  ? "supplier-state active"
                                  : "supplier-state"
                              }
                            >
                              {
                                supplier.active
                                  ? "Ativo"
                                  : "Inativo"
                              }
                            </span>
                          </div>


                          <span className="supplier-phone">
                            {
                              formatWhatsapp(
                                supplier.whatsapp,
                              )
                            }
                          </span>


                          <div className="supplier-tags">
                            {
                              selectedCategories.map(
                                (
                                  category,
                                ) => (
                                  <span
                                    key={
                                      category
                                    }
                                  >
                                    {
                                      category
                                    }
                                  </span>
                                ),
                              )
                            }
                          </div>
                        </div>


                        <form
                          action={
                            toggleSupplierAction
                          }
                        >
                          <input
                            type="hidden"
                            name="supplier_id"
                            value={
                              supplier.id
                            }
                          />

                          <input
                            type="hidden"
                            name="target_active"
                            value={
                              supplier.active
                                ? "false"
                                : "true"
                            }
                          />

                          <button
                            type="submit"
                            className="orbiq-secondary-button supplier-toggle"
                          >
                            {
                              supplier.active
                                ? "Desativar"
                                : "Ativar"
                            }
                          </button>
                        </form>
                      </div>


                      {supplier.notes ? (
                        <p className="supplier-note">
                          {
                            supplier.notes
                          }
                        </p>
                      ) : null}


                      <details className="supplier-edit">
                        <summary>
                          Editar fornecedor
                        </summary>


                        <form
                          action={
                            saveSupplierAction
                          }
                          className="orbiq-form supplier-edit-form"
                        >
                          <input
                            type="hidden"
                            name="supplier_id"
                            value={
                              supplier.id
                            }
                          />


                          <div className="orbiq-form-row">
                            <label>
                              <span>
                                Fornecedor *
                              </span>

                              <input
                                name="name"
                                required
                                defaultValue={
                                  supplier.name
                                }
                              />
                            </label>


                            <label>
                              <span>
                                WhatsApp
                              </span>

                              <input
                                name="whatsapp"
                                inputMode="tel"
                                defaultValue={
                                  supplier.whatsapp ??
                                  ""
                                }
                              />
                            </label>
                          </div>


                          <div className="supplier-category-field">
                            <span className="supplier-field-label">
                              Categorias *
                            </span>

                            <div className="supplier-category-grid edit">
                              {
                                categories.map(
                                  (category) => (
                                    <label
                                      key={
                                        category.id
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        name="category_ids"
                                        value={
                                          category.id
                                        }
                                        defaultChecked={
                                          selectedIds.includes(
                                            category.id,
                                          )
                                        }
                                      />

                                      <span>
                                        {
                                          category.name
                                        }
                                      </span>
                                    </label>
                                  ),
                                )
                              }
                            </div>
                          </div>


                          <label>
                            <span>
                              Observações
                            </span>

                            <textarea
                              name="notes"
                              rows={3}
                              defaultValue={
                                supplier.notes ??
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
                    </article>
                  );
                },
              )}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}