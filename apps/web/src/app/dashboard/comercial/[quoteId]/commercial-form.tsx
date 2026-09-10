"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  saveCommercialAction,
} from "./actions";


type Item = {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  side: string | null;
  specification: string | null;
  supplier_id: string | null;
  chosen_amount: number | null;
  sale_unit_amount: number | null;
  sale_total_amount: number | null;
};


type Props = {
  quoteId: string;
  laborTotal: number;
  items: Item[];
  discountType: string;
  discountValue: number;
  defaultMargin: number;
  locked: boolean;
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


function parseMoney(
  raw:
    string,
): number {

  let value =
    raw
      .trim()
      .replace(
        /\s/g,
        "",
      );


  if (!value) {

    return 0;
  }


  if (
    value.includes(
      ",",
    )
  ) {

    value =
      value
        .replace(
          /\./g,
          "",
        )
        .replace(
          ",",
          ".",
        );
  }


  const parsed =
    Number(
      value,
    );


  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}


function numberInput(
  value:
    number |
    null,
): string {

  if (
    value ===
    null
  ) {

    return "";
  }


  return String(
    value,
  ).replace(
    ".",
    ",",
  );
}



function saleFromLucro(
  cost: number,
  percent: number,
): number | null {

  if (
    !Number.isFinite(
      cost,
    ) ||
    !Number.isFinite(
      percent,
    ) ||
    percent <
      0 ||
    percent >=
      100
  ) {

    return null;
  }


  return (
    cost /
    (
      1 -
      percent /
      100
    )
  );
}


export function CommercialForm({
  quoteId,
  laborTotal,
  items,
  discountType: initialDiscountType,
  discountValue: initialDiscountValue,
  defaultMargin,
  locked,
}: Props) {

  const [
    salePrices,
    setSalePrices,
  ] =
    useState<
      Record<string, string>
    >(
      Object.fromEntries(
        items.map(
          (item) => [
            item.id,
            (() => {
              if (
                item.sale_unit_amount !==
                null
              ) {

                return numberInput(
                  item.sale_unit_amount,
                );
              }


              if (
                item.chosen_amount ===
                  null ||
                item.quantity <=
                  0
              ) {

                return "";
              }


              const priced =
                saleFromLucro(
                  item.chosen_amount /
                  item.quantity,
                  defaultMargin,
                );


              if (
                priced ===
                null
              ) {

                return "";
              }


              return priced
                .toFixed(
                  2,
                )
                .replace(
                  ".",
                  ",",
                );
            })(),
          ],
        ),
      ),
    );


  const [
    costTotals,
    setCostTotals,
  ] =
    useState<
      Record<string, string>
    >(
      Object.fromEntries(
        items.map(
          (item) => [
            item.id,
            numberInput(
              item.chosen_amount,
            ),
          ],
        ),
      ),
    );


  const [
    marginPercent,
    setMarginPercent,
  ] =
    useState(
      numberInput(
        defaultMargin,
      ),
    );


  const [
    discountType,
    setDiscountType,
  ] =
    useState(
      initialDiscountType ||
      "none",
    );


  const [
    discountValue,
    setDiscountValue,
  ] =
    useState(
      numberInput(
        initialDiscountValue,
      ),
    );


  const itemRows =
    useMemo(
      () =>
        items.map(
          (item) => {

            const unitSale =
              parseMoney(
                salePrices[
                  item.id
                ] ??
                "",
              );


            const saleTotal =
              unitSale *
              item.quantity;


            const costTotal =
              parseMoney(
                costTotals[
                  item.id
                ] ??
                "",
              );


            const unitCost =
              item.quantity >
              0
                ? costTotal /
                  item.quantity
                : 0;


            const profit =
              saleTotal -
              costTotal;


            const margin =
              saleTotal >
              0
                ? (
                    profit /
                    saleTotal
                  ) *
                  100
                : 0;


            return {
              ...item,
              unitSale,
              saleTotal,
              costTotal,
              unitCost,
              profit,
              margin,
            };
          },
        ),
      [
        items,
        salePrices,
        costTotals,
      ],
    );


  const partsCost =
    useMemo(
      () =>
        itemRows.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.costTotal,
          0,
        ),
      [
        itemRows,
      ],
    );


  const partsSale =
    useMemo(
      () =>
        itemRows.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.saleTotal,
          0,
        ),
      [
        itemRows,
      ],
    );


  const subtotal =
    laborTotal +
    partsSale;


  const discountNumber =
    parseMoney(
      discountValue,
    );


  const discountAmount =
    discountType ===
    "percentage"
      ? Math.min(
          subtotal,
          subtotal *
            (
              discountNumber /
              100
            ),
        )
      : discountType ===
        "fixed"
        ? Math.min(
            subtotal,
            discountNumber,
          )
        : 0;


  const finalAmount =
    Math.max(
      0,
      subtotal -
      discountAmount,
    );


  const partsProfit =
    partsSale -
    partsCost;


  const partsMargin =
    partsSale >
    0
      ? (
          partsProfit /
          partsSale
        ) *
        100
      : 0;


  const payload =
    itemRows.map(
      (item) => ({
        quote_item_id:
          item.id,

        sale_unit_amount:
          item.unitSale,

        cost_total_amount:
          item.costTotal,
      }),
    );


  function applyLucro() {

    const value =
      parseMoney(
        marginPercent,
      );


    if (
      value <
        0 ||
      value >=
        100
    ) {

      return;
    }


    const next:
      Record<string, string> =
        {};


    for (
      const item
      of items
    ) {

      const lineCost =
        parseMoney(
          costTotals[
            item.id
          ] ??
          "",
        );


      if (
        lineCost <=
          0 ||
        item.quantity <=
          0
      ) {

        next[
          item.id
        ] =
          salePrices[
            item.id
          ] ??
          "";

        continue;
      }


      const unitCost =
        lineCost /
        item.quantity;


      const newPrice =
        saleFromLucro(
          unitCost,
          value,
        );


      if (
        newPrice ===
        null
      ) {

        next[
          item.id
        ] =
          salePrices[
            item.id
          ] ??
          "";

        continue;
      }


      next[
        item.id
      ] =
        newPrice
          .toFixed(
            2,
          )
          .replace(
            ".",
            ",",
          );
    }


    setSalePrices(
      next,
    );
  }


  return (
    <form
      action={
        saveCommercialAction
      }
      className="commercial-form"
    >

      <input
        type="hidden"
        name="quote_id"
        value={
          quoteId
        }
      />


      <input
        type="hidden"
        name="items_json"
        value={
          JSON.stringify(
            payload,
          )
        }
      />


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              FORMAÇÃO DE PREÇO
            </span>

            <h2>
              Peças
            </h2>

            <p className="commercial-help">
              Preço direto: informe o custo da peça e o preço de venda. Cotar fornecedor é opcional.
            </p>

          </div>

        </div>


        {items.length >
        0 &&
        !locked ? (

          <div className="commercial-fast-path">
            <div>
              <strong>
                Já tenho o preço
              </strong>
              <span>
                Preencha o custo em cada peça abaixo e o preço de venda. Depois salve o comercial para enviar ao cliente — sem precisar cotar fornecedor.
              </span>
            </div>
          </div>

        ) : null}


        {items.length >
        0 &&
        !locked ? (

          <div className="commercial-markup-bar">

            <div>

              <span>
                Aplicar lucro rápido
              </span>

              <strong>
                % de lucro sobre a venda
              </strong>

            </div>


            <div className="commercial-markup-input">

              <input
                value={
                  marginPercent
                }
                onChange={
                  (event) =>
                    setMarginPercent(
                      event.target.value,
                    )
                }
                inputMode="decimal"
              />

              <span>
                %
              </span>

            </div>


            <button
              type="button"
              className="orbiq-secondary-button"
              onClick={
                applyLucro
              }
            >
              Aplicar em todas
            </button>

          </div>

        ) : null}


        {items.length ===
        0 ? (

          <div className="commercial-no-parts">

            <strong>
              Este orçamento não possui peças.
            </strong>

            <span>
              O valor comercial será composto somente pela mão de obra.
            </span>

          </div>

        ) : (

          <div className="commercial-items">

            <div className="commercial-items-head">

              <span>
                Peça
              </span>

              <span>
                Qtd.
              </span>

              <span>
                Custo
              </span>

              <span>
                Venda unit.
              </span>

              <span>
                Venda total
              </span>

              <span>
                Margem
              </span>

            </div>


            {itemRows.map(
              (item) => (

                <div
                  key={
                    item.id
                  }
                  className="commercial-item-row"
                >

                  <div>

                    <strong>
                      {item.description}
                    </strong>

                    <span>
                      {item.category}

                      {item.side
                        ? ` · ${item.side}`
                        : ""}

                      {item.specification
                        ? ` · ${item.specification}`
                        : ""}
                    </span>

                  </div>


                  <span>
                    {new Intl.NumberFormat(
                      "pt-BR",
                      {
                        maximumFractionDigits:
                          3,
                      },
                    ).format(
                      item.quantity,
                    )}{" "}
                    {item.unit}
                  </span>


                  <div>

                    <div className="commercial-sale-input">

                      <span>
                        R$
                      </span>

                      <input
                        value={
                          costTotals[
                            item.id
                          ] ??
                          ""
                        }
                        onChange={
                          (event) =>
                            setCostTotals(
                              (
                                current,
                              ) => ({
                                ...current,

                                [item.id]:
                                  event.target.value,
                              }),
                            )
                        }
                        inputMode="decimal"
                        disabled={
                          locked
                        }
                        required
                        aria-label={
                          `Custo total de ${item.description}`
                        }
                        placeholder="Custo total"
                      />

                    </div>

                    <span>
                      {item.supplier_id
                        ? "Do fornecedor (editável)"
                        : "Preço direto · total da linha"}
                    </span>

                  </div>


                  <div className="commercial-sale-input">

                    <span>
                      R$
                    </span>

                    <input
                      value={
                        salePrices[
                          item.id
                        ] ??
                        ""
                      }
                      onChange={
                        (event) =>
                          setSalePrices(
                            (
                              current,
                            ) => ({
                              ...current,

                              [item.id]:
                                event.target.value,
                            }),
                          )
                      }
                      inputMode="decimal"
                      disabled={
                        locked
                      }
                      required
                    />

                  </div>


                  <strong>
                    {money(
                      item.saleTotal,
                    )}
                  </strong>


                  <div>

                    <strong
                      className={
                        item.profit >=
                        0
                          ? "commercial-positive"
                          : "commercial-negative"
                      }
                    >
                      {item.margin.toFixed(
                        1,
                      )}%
                    </strong>

                    <span>
                      {money(
                        item.profit,
                      )}
                    </span>

                  </div>

                </div>

              ),
            )}

          </div>

        )}

      </section>


      <section className="commercial-summary-grid">

        <article>

          <span>
            Mão de obra
          </span>

          <strong>
            {money(
              laborTotal,
            )}
          </strong>

        </article>


        <article>

          <span>
            Custo peças
          </span>

          <strong>
            {money(
              partsCost,
            )}
          </strong>

        </article>


        <article>

          <span>
            Venda peças
          </span>

          <strong>
            {money(
              partsSale,
            )}
          </strong>

        </article>


        <article>

          <span>
            Lucro bruto peças
          </span>

          <strong
            className={
              partsProfit >=
              0
                ? "commercial-positive"
                : "commercial-negative"
            }
          >
            {money(
              partsProfit,
            )}
          </strong>

          <small>
            {partsMargin.toFixed(
              1,
            )}% de lucro
          </small>

        </article>

      </section>


      <section className="orbiq-panel commercial-discount-panel">

        <div>

          <span className="orbiq-eyebrow">
            DESCONTO
          </span>

          <h2>
            Condição comercial
          </h2>

        </div>


        <div className="commercial-discount-fields">

          <label>

            <span>
              Tipo
            </span>

            <select
              name="discount_type"
              value={
                discountType
              }
              onChange={
                (event) =>
                  setDiscountType(
                    event.target.value,
                  )
              }
              disabled={
                locked
              }
            >

              <option value="none">
                Sem desconto
              </option>

              <option value="fixed">
                Valor em R$
              </option>

              <option value="percentage">
                Percentual %
              </option>

            </select>

          </label>


          <label>

            <span>
              Valor
            </span>

            <input
              name="discount_value"
              value={
                discountType ===
                "none"
                  ? "0"
                  : discountValue
              }
              onChange={
                (event) =>
                  setDiscountValue(
                    event.target.value,
                  )
              }
              disabled={
                locked ||
                discountType ===
                  "none"
              }
              inputMode="decimal"
            />

          </label>

        </div>

      </section>


      <section className="commercial-final-card">

        <div>

          <span>
            Subtotal
          </span>

          <strong>
            {money(
              subtotal,
            )}
          </strong>

        </div>


        <div>

          <span>
            Desconto
          </span>

          <strong>
            - {money(
              discountAmount,
            )}
          </strong>

        </div>


        <div className="commercial-final-main">

          <span>
            TOTAL DO CLIENTE
          </span>

          <strong>
            {money(
              finalAmount,
            )}
          </strong>

        </div>


        {!locked ? (

          <button
            type="submit"
            className="orbiq-primary-button"
          >
            Salvar orçamento comercial
          </button>

        ) : (

          <span className="commercial-locked">
            Valores bloqueados após aprovação
          </span>

        )}

      </section>

    </form>
  );
}