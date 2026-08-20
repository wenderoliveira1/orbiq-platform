"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  getCurrentContext,
} from "../../_lib/current-organization";


function text(
  value:
    FormDataEntryValue |
    null,
): string {
  return String(
    value ??
      "",
  ).trim();
}


function normalize(
  value:
    string,
): string {
  return value
    .trim()
    .toLocaleLowerCase(
      "pt-BR",
    );
}


function fail(
  quoteId:
    string,

  message:
    string,
): never {
  redirect(
    `/dashboard/cotacoes/${quoteId}?error=${encodeURIComponent(
      message,
    )}`,
  );
}


function formatQuantity(
  value:
    number,
): string {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      maximumFractionDigits:
        3,
    },
  ).format(
    value,
  );
}


export async function prepareQuoteRequestsAction(
  formData:
    FormData,
): Promise<never> {
  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const quoteId =
    text(
      formData.get(
        "quote_id",
      ),
    );


  if (!quoteId) {
    redirect(
      "/dashboard/cotacoes",
    );
  }


  const supplierIds =
    [
      ...new Set(
        formData
          .getAll(
            "supplier_ids",
          )
          .map(
            (value) =>
              String(
                value,
              ).trim(),
          )
          .filter(Boolean),
      ),
    ];


  if (
    supplierIds.length ===
    0
  ) {
    return fail(
      quoteId,
      "Selecione pelo menos um fornecedor.",
    );
  }


  const {
    data: quote,
    error: quoteError,
  } =
    await supabase
      .from("quotes")
      .select(
        "id, protocol, vehicle_id",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        quoteId,
      )
      .maybeSingle();


  if (
    quoteError ||
    !quote
  ) {
    return fail(
      quoteId,
      quoteError?.message ??
        "Orçamento não encontrado.",
    );
  }


  const [
    vehicleResult,
    itemsResult,
    suppliersResult,
    categoriesResult,
    linksResult,
  ] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select(
          "id, plate, brand, model, version",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "id",
          quote.vehicle_id,
        )
        .maybeSingle(),

      supabase
        .from("quote_items")
        .select(
          "id, category, description, quantity, unit, side, specification, notes",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "quote_id",
          quoteId,
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        ),

      supabase
        .from("suppliers")
        .select(
          "id, name, whatsapp, active",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "id",
          supplierIds,
        ),

      supabase
        .from("supplier_categories")
        .select(
          "id, name, active",
        )
        .eq(
          "organization_id",
          organization.id,
        ),

      supabase
        .from("supplier_category_links")
        .select(
          "supplier_id, category_id",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .in(
          "supplier_id",
          supplierIds,
        ),
    ]);


  if (
    vehicleResult.error
  ) {
    return fail(
      quoteId,
      vehicleResult.error.message,
    );
  }


  if (
    itemsResult.error
  ) {
    return fail(
      quoteId,
      itemsResult.error.message,
    );
  }


  if (
    suppliersResult.error
  ) {
    return fail(
      quoteId,
      suppliersResult.error.message,
    );
  }


  if (
    categoriesResult.error
  ) {
    return fail(
      quoteId,
      categoriesResult.error.message,
    );
  }


  if (
    linksResult.error
  ) {
    return fail(
      quoteId,
      linksResult.error.message,
    );
  }


  const vehicle =
    vehicleResult.data;


  if (!vehicle) {
    return fail(
      quoteId,
      "Veículo do orçamento não encontrado.",
    );
  }


  const items =
    itemsResult.data ??
    [];


  if (
    items.length ===
    0
  ) {
    return fail(
      quoteId,
      "Esse orçamento não possui peças para cotar.",
    );
  }


  const suppliers =
    suppliersResult.data ??
    [];


  if (
    suppliers.length ===
    0
  ) {
    return fail(
      quoteId,
      "Nenhum fornecedor selecionado foi encontrado.",
    );
  }


  const categoryMap =
    new Map(
      (
        categoriesResult.data ??
        []
      )
        .filter(
          (category) =>
            category.active,
        )
        .map(
          (category) =>
            [
              category.id,
              normalize(
                category.name,
              ),
            ] as const,
        ),
    );


  const supplierCategories =
    new Map<
      string,
      Set<string>
    >();


  for (
    const link
    of linksResult.data ??
    []
  ) {
    if (
      !link.supplier_id ||
      !link.category_id
    ) {
      continue;
    }


    const categoryName =
      categoryMap.get(
        link.category_id,
      );


    if (
      !categoryName
    ) {
      continue;
    }


    const current =
      supplierCategories.get(
        link.supplier_id,
      ) ??
      new Set<string>();


    current.add(
      categoryName,
    );


    supplierCategories.set(
      link.supplier_id,
      current,
    );
  }


  const vehicleName =
    [
      vehicle.brand,
      vehicle.model,
      vehicle.version,
    ]
      .filter(Boolean)
      .join(" ");


  const requests:
    Array<{
      supplier_id:
        string;

      message:
        string;

      item_ids:
        string[];
    }> =
    [];


  for (
    const supplier
    of suppliers
  ) {
    if (
      !supplier.active
    ) {
      continue;
    }


    const whatsapp =
      String(
        supplier.whatsapp ??
          "",
      ).replace(
        /\D/g,
        "",
      );


    if (
      whatsapp.length <
        10 ||
      whatsapp.length >
        15
    ) {
      return fail(
        quoteId,
        `O fornecedor ${supplier.name} está sem um WhatsApp válido.`,
      );
    }


    const categories =
      supplierCategories.get(
        supplier.id,
      ) ??
      new Set<string>();


    const supplierItems =
      items.filter(
        (item) =>
          categories.has(
            normalize(
              item.category,
            ),
          ),
      );


    if (
      supplierItems.length ===
      0
    ) {
      continue;
    }


    const lines =
      supplierItems.map(
        (item) => {
          const complements =
            [
              item.side
                ? `lado: ${item.side}`
                : null,

              item.specification
                ? `especificação: ${item.specification}`
                : null,

              item.notes
                ? `obs.: ${item.notes}`
                : null,
            ]
              .filter(Boolean)
              .join(
                " | ",
              );


          return (
            `• [${item.category}] ` +
            `${formatQuantity(
              item.quantity,
            )} ${item.unit} — ` +
            `${item.description}` +
            (
              complements
                ? ` | ${complements}`
                : ""
            )
          );
        },
      );


    const message =
      [
        "Olá, tudo bem?",

        "",

        "Gostaria de solicitar uma cotação para nossa oficina.",

        "",

        `Protocolo: ${quote.protocol}`,

        `Veículo: ${vehicleName || "Não informado"}`,

        `Placa: ${vehicle.plate}`,

        "",

        "Itens:",

        ...lines,

        "",

        "Por favor, informe:",

        "• Marca / opção",

        "• Valor",

        "• Disponibilidade",

        "• Prazo / entrega",

        "",

        "Obrigado!",
      ].join(
        "\n",
      );


    requests.push({
      supplier_id:
        supplier.id,

      message,

      item_ids:
        supplierItems.map(
          (item) =>
            item.id,
        ),
    });
  }


  if (
    requests.length ===
    0
  ) {
    return fail(
      quoteId,
      "Nenhum fornecedor selecionado atende às categorias das peças desse orçamento.",
    );
  }


  const {
    data: preparedCount,
    error,
  } =
    await supabase.rpc(
      "prepare_quote_supplier_requests",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,

        target_requests:
          requests,
      },
    );


  if (error) {
    return fail(
      quoteId,
      `Não foi possível preparar as cotações: ${error.message}`,
    );
  }


  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/orcamentos",
  );

  revalidatePath(
    `/dashboard/orcamentos/${quoteId}`,
  );

  revalidatePath(
    "/dashboard/cotacoes",
  );

  revalidatePath(
    `/dashboard/cotacoes/${quoteId}`,
  );


  redirect(
    `/dashboard/cotacoes/${quoteId}?prepared=${encodeURIComponent(
      String(
        preparedCount ??
          requests.length,
      ),
    )}`,
  );
}