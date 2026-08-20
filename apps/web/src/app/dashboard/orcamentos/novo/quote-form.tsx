"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  createQuoteAction,
} from "./actions";


type Customer = {
  id: string;
  name: string;
  phone: string | null;
};


type Vehicle = {
  id: string;
  customer_id: string | null;
  plate: string;
  brand: string | null;
  model: string;
  version: string | null;
  mileage: number | null;
};


type PartRule = {
  category: string;
  description: string;
  unit?: string;
};


type ServiceDefinition = {
  category: string;
  description: string;
  part?: PartRule;
};


type SelectedService = {
  key: string;
  category: string;
  description: string;
  needs_part: boolean;
  labor_amount: null;
};


type QuoteItem = {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  side: string;
  specification: string;
  notes: string;
  source?: string;
};


const CATALOG:
  ServiceDefinition[] =
[
  {
    category:
      "Mecânica geral",

    description:
      "Trocar coxim do motor",

    part: {
      category:
        "Mecânica",

      description:
        "Coxim do motor",
    },
  },

  {
    category:
      "Mecânica geral",

    description:
      "Trocar correia de acessórios",

    part: {
      category:
        "Mecânica",

      description:
        "Correia de acessórios",
    },
  },

  {
    category:
      "Mecânica geral",

    description:
      "Trocar tensor da correia",

    part: {
      category:
        "Mecânica",

      description:
        "Tensor da correia",
    },
  },

  {
    category:
      "Suspensão e direção",

    description:
      "Trocar pivô",

    part: {
      category:
        "Chassi - Paralelo/Original",

      description:
        "Pivô",
    },
  },

  {
    category:
      "Suspensão e direção",

    description:
      "Trocar amortecedor",

    part: {
      category:
        "Chassi - Paralelo/Original",

      description:
        "Amortecedor",
    },
  },

  {
    category:
      "Suspensão e direção",

    description:
      "Trocar kit do amortecedor",

    part: {
      category:
        "Chassi - Paralelo/Original",

      description:
        "Kit do amortecedor",

      unit:
        "kit",
    },
  },

  {
    category:
      "Suspensão e direção",

    description:
      "Trocar bandeja",

    part: {
      category:
        "Chassi - Paralelo/Original",

      description:
        "Bandeja",
    },
  },

  {
    category:
      "Suspensão e direção",

    description:
      "Verificar folga/barulho na suspensão",
  },

  {
    category:
      "Freios",

    description:
      "Trocar pastilhas de freio",

    part: {
      category:
        "Mecânica",

      description:
        "Pastilhas de freio",

      unit:
        "jogo",
    },
  },

  {
    category:
      "Freios",

    description:
      "Trocar discos de freio",

    part: {
      category:
        "Mecânica",

      description:
        "Discos de freio",

      unit:
        "par",
    },
  },

  {
    category:
      "Freios",

    description:
      "Trocar fluido de freio",

    part: {
      category:
        "Óleos e Lubrificantes",

      description:
        "Fluido de freio",

      unit:
        "litro",
    },
  },

  {
    category:
      "Arrefecimento",

    description:
      "Substituir radiador",

    part: {
      category:
        "Mecânica",

      description:
        "Radiador",
    },
  },

  {
    category:
      "Arrefecimento",

    description:
      "Trocar bomba d'água",

    part: {
      category:
        "Mecânica",

      description:
        "Bomba d'água",
    },
  },

  {
    category:
      "Arrefecimento",

    description:
      "Verificar vazamento no sistema",
  },

  {
    category:
      "Motor e injeção",

    description:
      "Passar scanner",
  },

  {
    category:
      "Motor e injeção",

    description:
      "Trocar velas",

    part: {
      category:
        "Mecânica",

      description:
        "Jogo de velas",

      unit:
        "jogo",
    },
  },

  {
    category:
      "Óleo e revisão",

    description:
      "Troca de óleo do motor",

    part: {
      category:
        "Óleos e Lubrificantes",

      description:
        "Óleo do motor",

      unit:
        "litro",
    },
  },

  {
    category:
      "Óleo e revisão",

    description:
      "Trocar filtro de óleo",

    part: {
      category:
        "Mecânica",

      description:
        "Filtro de óleo",
    },
  },

  {
    category:
      "Óleo e revisão",

    description:
      "Trocar filtro de ar",

    part: {
      category:
        "Mecânica",

      description:
        "Filtro de ar",
    },
  },

  {
    category:
      "Pneus e geometria",

    description:
      "Trocar pneu",

    part: {
      category:
        "Pneus",

      description:
        "Pneu",
    },
  },

  {
    category:
      "Pneus e geometria",

    description:
      "Alinhamento",
  },

  {
    category:
      "Pneus e geometria",

    description:
      "Balanceamento",
  },
];


const BODY_ACTIONS = [
  "Esticar",
  "Reparar",
  "Desamassar",
  "Recuperar",
  "Pintura",
];


const BODY_PARTS = [
  "Capô",
  "Teto",
  "Para-choque dianteiro",
  "Para-choque traseiro",
  "Paralama esquerdo",
  "Paralama direito",
  "Porta esquerda",
  "Porta direita",
  "Lateral esquerda",
  "Lateral direita",
  "Tampa traseira",
];


const UNITS = [
  "un",
  "par",
  "kit",
  "jogo",
  "litro",
];


const SIDES = [
  "",
  "Esquerdo",
  "Direito",
  "Dianteiro",
  "Traseiro",
  "Dianteiro esquerdo",
  "Dianteiro direito",
  "Traseiro esquerdo",
  "Traseiro direito",
];


function serviceKey(
  category: string,
  description: string,
): string {
  return (
    category +
    "||" +
    description
  );
}


function newItemId(): string {
  return (
    "item-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(16)
      .slice(2)
  );
}


export function QuoteForm({
  customers,
  vehicles,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
}) {
  const categories =
    useMemo(
      () => [
        ...new Set(
          CATALOG.map(
            (service) =>
              service.category,
          ),
        ),
      ],
      [],
    );


  const [
    customerId,
    setCustomerId,
  ] =
    useState("");


  const [
    vehicleId,
    setVehicleId,
  ] =
    useState("");


  const [
    priority,
    setPriority,
  ] =
    useState(
      "normal",
    );


  const [
    mileage,
    setMileage,
  ] =
    useState("");


  const [
    category,
    setCategory,
  ] =
    useState(
      categories[0] ??
        "Mecânica geral",
    );


  const [
    services,
    setServices,
  ] =
    useState<
      SelectedService[]
    >([]);


  const [
    items,
    setItems,
  ] =
    useState<
      QuoteItem[]
    >([]);


  const [
    customService,
    setCustomService,
  ] =
    useState("");


  const [
    bodyAction,
    setBodyAction,
  ] =
    useState(
      BODY_ACTIONS[0],
    );


  const [
    selectedBodyParts,
    setSelectedBodyParts,
  ] =
    useState<
      string[]
    >([]);


  const [
    draft,
    setDraft,
  ] =
    useState({
      category:
        "Mecânica",

      description:
        "",

      quantity:
        "1",

      unit:
        "un",

      side:
        "",

      specification:
        "",
    });


  const customerVehicles =
    vehicles.filter(
      (vehicle) =>
        vehicle.customer_id ===
        customerId,
    );


  const visibleServices =
    CATALOG.filter(
      (service) =>
        service.category ===
        category,
    );


  function selectCustomer(
    value: string,
  ) {
    setCustomerId(
      value,
    );

    setVehicleId("");

    setMileage("");
  }


  function selectVehicle(
    value: string,
  ) {
    setVehicleId(
      value,
    );

    const vehicle =
      vehicles.find(
        (item) =>
          item.id === value,
      );

    if (
      vehicle?.mileage ===
        null ||
      vehicle?.mileage ===
        undefined
    ) {

      setMileage("");

      return;
    }

    setMileage(
      String(
        vehicle.mileage,
      ),
    );
  }


  function toggleService(
    definition:
      ServiceDefinition,
  ) {
    const key =
      serviceKey(
        definition.category,
        definition.description,
      );


    const alreadySelected =
      services.some(
        (service) =>
          service.key === key,
      );


    if (
      alreadySelected
    ) {
      setServices(
        (current) =>
          current.filter(
            (service) =>
              service.key !==
              key,
          ),
      );

      setItems(
        (current) =>
          current.filter(
            (item) =>
              item.source !==
              key,
          ),
      );

      return;
    }


    setServices(
      (current) => [
        ...current,

        {
          key,

          category:
            definition.category,

          description:
            definition.description,

          needs_part:
            Boolean(
              definition.part,
            ),

          labor_amount:
            null,
        },
      ],
    );


    if (
      definition.part
    ) {
      setItems(
        (current) => {
          const samePart =
            current.some(
              (item) =>
                item.description
                  .toLocaleLowerCase(
                    "pt-BR",
                  ) ===
                definition
                  .part!
                  .description
                  .toLocaleLowerCase(
                    "pt-BR",
                  ) &&
                item.source ===
                  key,
            );

          if (
            samePart
          ) {

            return current;
          }

          return [
            ...current,

            {
              id:
                newItemId(),

              category:
                definition
                  .part!
                  .category,

              description:
                definition
                  .part!
                  .description,

              quantity:
                1,

              unit:
                definition
                  .part!
                  .unit ??
                "un",

              side:
                "",

              specification:
                "",

              notes:
                "Adicionado automaticamente pelo serviço.",

              source:
                key,
            },
          ];
        },
      );
    }
  }


  function addCustomService() {
    const description =
      customService.trim();

    if (!description) {

      return;
    }

    const key =
      serviceKey(
        category,
        description,
      );

    setServices(
      (current) => {
        if (
          current.some(
            (service) =>
              service.key === key,
          )
        ) {

          return current;
        }

        return [
          ...current,

          {
            key,

            category,

            description,

            needs_part:
              false,

            labor_amount:
              null,
          },
        ];
      },
    );

    setCustomService("");
  }


  function addBodyworkServices() {
    if (
      selectedBodyParts.length ===
      0
    ) {

      return;
    }

    setServices(
      (current) => {
        const next =
          [...current];

        for (
          const bodyPart
          of selectedBodyParts
        ) {
          const description =
            bodyAction +
            " " +
            bodyPart;

          const key =
            serviceKey(
              "Funilaria e estrutura",
              description,
            );

          const exists =
            next.some(
              (service) =>
                service.key ===
                key,
            );

          if (!exists) {
            next.push({
              key,

              category:
                "Funilaria e estrutura",

              description,

              needs_part:
                false,

              labor_amount:
                null,
            });
          }
        }

        return next;
      },
    );

    setSelectedBodyParts([]);
  }


  function removeService(
    key: string,
  ) {
    setServices(
      (current) =>
        current.filter(
          (service) =>
            service.key !==
            key,
        ),
    );

    setItems(
      (current) =>
        current.filter(
          (item) =>
            item.source !==
            key,
        ),
    );
  }


  function addItem() {
    const description =
      draft.description.trim();

    const quantity =
      Number(
        draft.quantity,
      );

    if (
      !description ||
      !Number.isFinite(
        quantity,
      ) ||
      quantity <= 0
    ) {

      return;
    }


    setItems(
      (current) => [
        ...current,

        {
          id:
            newItemId(),

          category:
            draft.category,

          description,

          quantity,

          unit:
            draft.unit,

          side:
            draft.side,

          specification:
            draft.specification.trim(),

          notes:
            "",
        },
      ],
    );


    setDraft(
      (current) => ({
        ...current,

        description:
          "",

        quantity:
          "1",

        specification:
          "",
      }),
    );
  }


  function updateItem(
    id: string,
    patch:
      Partial<QuoteItem>,
  ) {
    setItems(
      (current) =>
        current.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  ...patch,
                }
              : item,
        ),
    );
  }


  const servicesJson =
    JSON.stringify(
      services.map(
        (service) => ({
          category:
            service.category,

          description:
            service.description,

          needs_part:
            service.needs_part,

          labor_amount:
            null,
        }),
      ),
    );


  const itemsJson =
    JSON.stringify(
      items.map(
        (item) => ({
          category:
            item.category,

          description:
            item.description,

          quantity:
            item.quantity,

          unit:
            item.unit,

          side:
            item.side ||
            null,

          specification:
            item.specification ||
            null,

          notes:
            item.notes ||
            null,
        }),
      ),
    );


  const canSave =
    Boolean(
      customerId &&
      vehicleId &&
      (
        services.length >
          0 ||
        items.length >
          0
      ),
    );


  return (
    <form
      action={
        createQuoteAction
      }
      className="q-builder"
    >
      <input
        type="hidden"
        name="services_json"
        value={
          servicesJson
        }
      />

      <input
        type="hidden"
        name="items_json"
        value={
          itemsJson
        }
      />


      <section className="orbiq-panel q-section">
        <div className="q-title">
          <b>
            1
          </b>

          <div>
            <span className="orbiq-eyebrow">
              ATENDIMENTO
            </span>

            <h2>
              Cliente e veículo
            </h2>
          </div>
        </div>


        <div className="orbiq-form">
          <div className="orbiq-form-row">
            <label>
              <span>
                Cliente *
              </span>

              <select
                name="customer_id"
                value={
                  customerId
                }
                onChange={
                  (event) =>
                    selectCustomer(
                      event.target.value,
                    )
                }
                required
              >
                <option value="">
                  Selecione
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

                      {
                        customer.phone
                          ? ` · ${customer.phone}`
                          : ""
                      }
                    </option>
                  ),
                )}
              </select>
            </label>


            <label>
              <span>
                Veículo *
              </span>

              <select
                name="vehicle_id"
                value={
                  vehicleId
                }
                onChange={
                  (event) =>
                    selectVehicle(
                      event.target.value,
                    )
                }
                disabled={
                  !customerId
                }
                required
              >
                <option value="">
                  {
                    customerId
                      ? "Selecione"
                      : "Selecione o cliente primeiro"
                  }
                </option>

                {
                  customerVehicles.map(
                    (vehicle) => (
                      <option
                        key={
                          vehicle.id
                        }
                        value={
                          vehicle.id
                        }
                      >
                        {
                          vehicle.plate
                        }
                        {" · "}
                        {
                          [
                            vehicle.brand,
                            vehicle.model,
                            vehicle.version,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              " ",
                            )
                        }
                      </option>
                    ),
                  )
                }
              </select>
            </label>
          </div>


          <div>
            <span className="q-label">
              Prioridade
            </span>

            <div className="q-priorities">
              {[
                {
                  value:
                    "normal",

                  label:
                    "Normal",
                },

                {
                  value:
                    "customer_waiting",

                  label:
                    "Cliente aguardando",
                },

                {
                  value:
                    "vehicle_stopped",

                  label:
                    "Veículo parado",
                },
              ].map(
                (option) => (
                  <label
                    key={
                      option.value
                    }
                    className={
                      priority ===
                      option.value
                        ? "on"
                        : ""
                    }
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={
                        option.value
                      }
                      checked={
                        priority ===
                        option.value
                      }
                      onChange={
                        () =>
                          setPriority(
                            option.value,
                          )
                      }
                    />

                    <span>
                      {
                        option.label
                      }
                    </span>
                  </label>
                ),
              )}
            </div>
          </div>


          <div className="orbiq-form-row">
            <label>
              <span>
                Quilometragem
              </span>

              <input
                name="mileage"
                type="number"
                min="0"
                step="1"
                value={
                  mileage
                }
                onChange={
                  (event) =>
                    setMileage(
                      event.target.value,
                    )
                }
                placeholder="Ex.: 85640"
              />
            </label>


            <label>
              <span>
                Observações
              </span>

              <input
                name="notes"
                placeholder="Ex.: cliente relata barulho ao esterçar"
              />
            </label>
          </div>
        </div>
      </section>


      <section className="orbiq-panel q-section">
        <div className="q-title">
          <b>
            2
          </b>

          <div>
            <span className="orbiq-eyebrow">
              SERVIÇOS
            </span>

            <h2>
              Marque e siga
            </h2>
          </div>
        </div>


        <div className="q-tabs">
          {
            categories.map(
              (
                currentCategory,
              ) => (
                <button
                  key={
                    currentCategory
                  }
                  type="button"
                  className={
                    category ===
                    currentCategory
                      ? "on"
                      : ""
                  }
                  onClick={
                    () =>
                      setCategory(
                        currentCategory,
                      )
                  }
                >
                  {
                    currentCategory
                  }
                </button>
              ),
            )
          }

          <button
            type="button"
            className={
              category ===
              "Funilaria e estrutura"
                ? "on"
                : ""
            }
            onClick={
              () =>
                setCategory(
                  "Funilaria e estrutura",
                )
            }
          >
            Funilaria
          </button>
        </div>


        {
          category ===
          "Funilaria e estrutura"
            ? (
              <div className="q-body">
                <div className="q-tabs">
                  {
                    BODY_ACTIONS.map(
                      (action) => (
                        <button
                          key={
                            action
                          }
                          type="button"
                          className={
                            bodyAction ===
                            action
                              ? "on"
                              : ""
                          }
                          onClick={
                            () =>
                              setBodyAction(
                                action,
                              )
                          }
                        >
                          {
                            action.toUpperCase()
                          }
                        </button>
                      ),
                    )
                  }
                </div>


                <div className="q-grid">
                  {
                    BODY_PARTS.map(
                      (bodyPart) => {
                        const checked =
                          selectedBodyParts.includes(
                            bodyPart,
                          );

                        return (
                          <label
                            key={
                              bodyPart
                            }
                            className={
                              checked
                                ? "on"
                                : ""
                            }
                          >
                            <input
                              type="checkbox"
                              checked={
                                checked
                              }
                              onChange={
                                () => {
                                  setSelectedBodyParts(
                                    (
                                      current,
                                    ) =>
                                      checked
                                        ? current.filter(
                                            (
                                              item,
                                            ) =>
                                              item !==
                                              bodyPart,
                                          )
                                        : [
                                            ...current,
                                            bodyPart,
                                          ],
                                  );
                                }
                              }
                            />

                            <span>
                              {
                                bodyPart
                              }
                            </span>
                          </label>
                        );
                      },
                    )
                  }
                </div>


                <button
                  type="button"
                  className="orbiq-secondary-button"
                  disabled={
                    selectedBodyParts.length ===
                    0
                  }
                  onClick={
                    addBodyworkServices
                  }
                >
                  + Adicionar serviços
                </button>
              </div>
            )
            : (
              <div className="q-grid">
                {
                  visibleServices.map(
                    (
                      definition,
                    ) => {
                      const key =
                        serviceKey(
                          definition.category,
                          definition.description,
                        );

                      const checked =
                        services.some(
                          (service) =>
                            service.key ===
                            key,
                        );

                      return (
                        <label
                          key={
                            key
                          }
                          className={
                            checked
                              ? "on"
                              : ""
                          }
                        >
                          <input
                            type="checkbox"
                            checked={
                              checked
                            }
                            onChange={
                              () =>
                                toggleService(
                                  definition,
                                )
                            }
                          />

                          <span>
                            <strong>
                              {
                                definition.description
                              }
                            </strong>

                            <small>
                              {
                                definition.part
                                  ? `+ ${definition.part.description}`
                                  : "Somente serviço"
                              }
                            </small>
                          </span>
                        </label>
                      );
                    },
                  )
                }
              </div>
            )
        }


        <div className="q-add">
          <input
            value={
              customService
            }
            onChange={
              (event) =>
                setCustomService(
                  event.target.value,
                )
            }
            onKeyDown={
              (event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  event.preventDefault();

                  addCustomService();
                }
              }
            }
            placeholder="Outro serviço não listado"
          />

          <button
            type="button"
            className="orbiq-secondary-button"
            onClick={
              addCustomService
            }
          >
            + Adicionar
          </button>
        </div>


        {
          services.length >
          0
            ? (
              <div className="q-chips">
                {
                  services.map(
                    (service) => (
                      <button
                        key={
                          service.key
                        }
                        type="button"
                        onClick={
                          () =>
                            removeService(
                              service.key,
                            )
                        }
                      >
                        {
                          service.description
                        }
                        {" ×"}
                      </button>
                    ),
                  )
                }
              </div>
            )
            : null
        }
      </section>


      <section className="orbiq-panel q-section">
        <div className="q-title">
          <b>
            3
          </b>

          <div>
            <span className="orbiq-eyebrow">
              PEÇAS / ITENS
            </span>

            <h2>
              Somente o necessário
            </h2>
          </div>
        </div>


        <div className="q-item-add">
          <select
            value={
              draft.category
            }
            onChange={
              (event) =>
                setDraft(
                  (current) => ({
                    ...current,

                    category:
                      event.target.value,
                  }),
                )
            }
          >
            {[
              "Mecânica",
              "Chassi - Paralelo/Original",
              "Chassi - Ferro Velho",
              "Pneus",
              "Vidros",
              "Óleos e Lubrificantes",
              "Outros",
            ].map(
              (
                currentCategory,
              ) => (
                <option
                  key={
                    currentCategory
                  }
                  value={
                    currentCategory
                  }
                >
                  {
                    currentCategory
                  }
                </option>
              ),
            )}
          </select>


          <input
            value={
              draft.description
            }
            onChange={
              (event) =>
                setDraft(
                  (current) => ({
                    ...current,

                    description:
                      event.target.value,
                  }),
                )
            }
            placeholder="Peça / item"
          />


          <input
            type="number"
            min="0.001"
            step="0.001"
            value={
              draft.quantity
            }
            onChange={
              (event) =>
                setDraft(
                  (current) => ({
                    ...current,

                    quantity:
                      event.target.value,
                  }),
                )
            }
            placeholder="Qtd."
          />


          <select
            value={
              draft.unit
            }
            onChange={
              (event) =>
                setDraft(
                  (current) => ({
                    ...current,

                    unit:
                      event.target.value,
                  }),
                )
            }
          >
            {
              UNITS.map(
                (unit) => (
                  <option
                    key={
                      unit
                    }
                    value={
                      unit
                    }
                  >
                    {
                      unit
                    }
                  </option>
                ),
              )
            }
          </select>


          <select
            value={
              draft.side
            }
            onChange={
              (event) =>
                setDraft(
                  (current) => ({
                    ...current,

                    side:
                      event.target.value,
                  }),
                )
            }
          >
            {
              SIDES.map(
                (side) => (
                  <option
                    key={
                      side ||
                      "none"
                    }
                    value={
                      side
                    }
                  >
                    {
                      side ||
                      "Sem lado"
                    }
                  </option>
                ),
              )
            }
          </select>


          <input
            value={
              draft.specification
            }
            onChange={
              (event) =>
                setDraft(
                  (current) => ({
                    ...current,

                    specification:
                      event.target.value,
                  }),
                )
            }
            placeholder="Marca / especificação"
          />


          <button
            type="button"
            className="orbiq-secondary-button"
            onClick={
              addItem
            }
          >
            +
          </button>
        </div>


        {
          items.length ===
          0
            ? (
              <div className="orbiq-empty compact">
                <strong>
                  Nenhuma peça adicionada.
                </strong>

                <span>
                  Serviços mapeados adicionam a peça automaticamente.
                </span>
              </div>
            )
            : (
              <div className="q-items">
                {
                  items.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                      >
                        <div>
                          <strong>
                            {
                              item.description
                            }
                          </strong>

                          <span>
                            {
                              item.category
                            }

                            {
                              item.source
                                ? " · automática"
                                : ""
                            }
                          </span>
                        </div>


                        <input
                          aria-label="Quantidade"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={
                            item.quantity
                          }
                          onChange={
                            (event) => {
                              const value =
                                Number(
                                  event.target.value,
                                );

                              updateItem(
                                item.id,
                                {
                                  quantity:
                                    Number.isFinite(
                                      value,
                                    )
                                      ? value
                                      : 0,
                                },
                              );
                            }
                          }
                        />


                        <select
                          value={
                            item.unit
                          }
                          onChange={
                            (event) =>
                              updateItem(
                                item.id,
                                {
                                  unit:
                                    event.target.value,
                                },
                              )
                          }
                        >
                          {
                            UNITS.map(
                              (unit) => (
                                <option
                                  key={
                                    unit
                                  }
                                  value={
                                    unit
                                  }
                                >
                                  {
                                    unit
                                  }
                                </option>
                              ),
                            )
                          }
                        </select>


                        <select
                          value={
                            item.side
                          }
                          onChange={
                            (event) =>
                              updateItem(
                                item.id,
                                {
                                  side:
                                    event.target.value,
                                },
                              )
                          }
                        >
                          {
                            SIDES.map(
                              (side) => (
                                <option
                                  key={
                                    side ||
                                    "none"
                                  }
                                  value={
                                    side
                                  }
                                >
                                  {
                                    side ||
                                    "Sem lado"
                                  }
                                </option>
                              ),
                            )
                          }
                        </select>


                        <button
                          type="button"
                          className="q-remove"
                          aria-label={
                            `Remover ${item.description}`
                          }
                          onClick={
                            () =>
                              setItems(
                                (current) =>
                                  current.filter(
                                    (
                                      currentItem,
                                    ) =>
                                      currentItem.id !==
                                      item.id,
                                  ),
                              )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ),
                  )
                }
              </div>
            )
        }
      </section>


      <div className="q-footer">
        <div>
          <strong>
            {
              services.length
            }{" "}
            serviço(s)
          </strong>

          <span>
            {
              items.length
            }{" "}
            peça(s)
          </span>
        </div>

        <button
          type="submit"
          className="orbiq-primary-button"
          disabled={
            !canSave
          }
        >
          Salvar orçamento
        </button>
      </div>
    </form>
  );
}