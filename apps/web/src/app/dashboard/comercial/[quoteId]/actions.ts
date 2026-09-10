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


function parseMoney(
  raw:
    string,
): number | null {

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


  if (
    !Number.isFinite(
      parsed,
    )
  ) {

    return null;
  }


  return parsed;
}


function fail(
  quoteId:
    string,

  message:
    string,
): never {

  redirect(
    `/dashboard/comercial/${quoteId}?error=${encodeURIComponent(
      message,
    )}`,
  );
}


function success(
  quoteId:
    string,

  message:
    string,
): never {

  redirect(
    `/dashboard/comercial/${quoteId}?ok=${encodeURIComponent(
      message,
    )}`,
  );
}


function refresh(
  quoteId:
    string,
) {

  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/comercial",
  );

  revalidatePath(
    `/dashboard/comercial/${quoteId}`,
  );

  revalidatePath(
    "/dashboard/orcamentos",
  );

  revalidatePath(
    `/dashboard/orcamentos/${quoteId}`,
  );

  revalidatePath(
    "/dashboard/compras",
  );

  revalidatePath(
    "/dashboard/execucao",
  );
}


export async function saveCommercialAction(
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


  const itemsRaw =
    text(
      formData.get(
        "items_json",
      ),
    );


  const discountType =
    text(
      formData.get(
        "discount_type",
      ),
    ) ||
    "none";


  const discountValue =
    parseMoney(
      text(
        formData.get(
          "discount_value",
        ),
      ),
    );


  if (!quoteId) {

    redirect(
      "/dashboard/comercial",
    );
  }


  if (
    discountValue ===
      null ||
    discountValue <
      0
  ) {

    return fail(
      quoteId,
      "Informe um desconto válido.",
    );
  }


  let items;


  try {

    items =
      JSON.parse(
        itemsRaw ||
        "[]",
      );
  }
  catch {

    return fail(
      quoteId,
      "Os preços das peças estão inválidos.",
    );
  }


  if (
    !Array.isArray(
      items,
    )
  ) {

    return fail(
      quoteId,
      "A lista comercial de peças está inválida.",
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "save_quote_commercial",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,

        target_items:
          items,

        target_discount_type:
          discountType,

        target_discount_value:
          discountValue,
      },
    );


  if (error) {

    return fail(
      quoteId,
      `Não foi possível salvar o comercial: ${error.message}`,
    );
  }


  refresh(
    quoteId,
  );


  return success(
    quoteId,
    "Orçamento comercial salvo. Agora ele pode ser apresentado ao cliente.",
  );
}


export async function approveCommercialAction(
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
      "/dashboard/comercial",
    );
  }


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "approve_quote_commercial",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,
      },
    );


  if (error) {

    const message =
      error.message.includes(
        "Part cost is incomplete",
      ) ||
      error.message.includes(
        "Supplier selection is incomplete",
      )
        ? "Ainda existe peça sem custo. Informe o preço direto no comercial ou finalize a cotação dos fornecedores."
        : error.message.includes(
            "must be saved",
          )
          ? "Salve o orçamento comercial antes de aprová-lo."
          : `Não foi possível aprovar: ${error.message}`;


    return fail(
      quoteId,
      message,
    );
  }


  refresh(
    quoteId,
  );


  return success(
    quoteId,
    data ===
      "awaiting_parts"
      ? "Aprovado pelo cliente. O orçamento foi liberado para Compras."
      : "Aprovado pelo cliente. O veículo foi liberado para execução.",
  );
}


export async function rejectCommercialAction(
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


  const reason =
    text(
      formData.get(
        "reason",
      ),
    );


  if (!quoteId) {

    redirect(
      "/dashboard/comercial",
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "reject_quote_commercial",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,

        target_reason:
          reason,
      },
    );


  if (error) {

    return fail(
      quoteId,
      `Não foi possível reprovar: ${error.message}`,
    );
  }


  refresh(
    quoteId,
  );


  return success(
    quoteId,
    "Orçamento marcado como reprovado pelo cliente.",
  );
}


export async function reopenCommercialAction(
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


  const returnTo =
    text(
      formData.get(
        "return_to",
      ),
    );


  const confirmation =
    text(
      formData.get(
        "confirmation",
      ),
    ).toLowerCase();


  const destinationBase =
    returnTo ===
      "orcamentos"
      ? `/dashboard/orcamentos/${quoteId}`
      : `/dashboard/comercial/${quoteId}`;


  function reopenFail(
    message:
      string,
  ): never {

    redirect(
      `${destinationBase}?error=${encodeURIComponent(
        message,
      )}`,
    );
  }


  function reopenSuccess(
    message:
      string,
  ): never {

    redirect(
      `${destinationBase}?ok=${encodeURIComponent(
        message,
      )}`,
    );
  }


  if (!quoteId) {

    redirect(
      returnTo ===
        "orcamentos"
        ? "/dashboard/orcamentos"
        : "/dashboard/comercial",
    );
  }


  if (
    confirmation !==
      "sim"
  ) {

    return reopenFail(
      'Digite "sim" para confirmar a reabertura do orçamento.',
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "reopen_quote_commercial",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,
      },
    );


  if (error) {

    const message =
      error.message.includes(
        "active purchase orders",
      )
        ? "Não é possível reabrir: já existem pedidos de compra ativos neste orçamento."
        : error.message.includes(
            "workshop execution",
          )
          ? "Não é possível reabrir: o orçamento já entrou em execução na oficina."
          : `Não foi possível reabrir: ${error.message}`;


    return reopenFail(
      message,
    );
  }


  refresh(
    quoteId,
  );


  return reopenSuccess(
    "Orçamento reaberto para edição. Você já pode alterar valores, quantidades e serviços.",
  );
}