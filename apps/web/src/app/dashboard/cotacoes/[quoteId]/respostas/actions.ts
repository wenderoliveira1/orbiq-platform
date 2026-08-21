"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  getCurrentContext,
} from "../../../_lib/current-organization";


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


function fail(
  quoteId:
    string,

  message:
    string,
): never {
  redirect(
    `/dashboard/cotacoes/${quoteId}/respostas?error=${encodeURIComponent(
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
    `/dashboard/cotacoes/${quoteId}/respostas?ok=${encodeURIComponent(
      message,
    )}`,
  );
}


function parseMoney(
  raw:
    string,
): number | null {
  const value =
    raw
      .trim()
      .replace(
        /\s/g,
        "",
      );


  if (!value) {
    return null;
  }


  let normalized =
    value;


  if (
    normalized.includes(
      ",",
    )
  ) {

    normalized =
      normalized
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
      normalized,
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


export async function saveSupplierResponseAction(
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


  const requestId =
    text(
      formData.get(
        "request_id",
      ),
    );


  if (
    !quoteId ||
    !requestId
  ) {
    redirect(
      "/dashboard/cotacoes",
    );
  }


  const {
    data: request,
    error: requestError,
  } =
    await supabase
      .from(
        "quote_supplier_requests",
      )
      .select(
        "id, quote_id, supplier_id, status",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        requestId,
      )
      .eq(
        "quote_id",
        quoteId,
      )
      .maybeSingle();


  if (
    requestError ||
    !request
  ) {
    return fail(
      quoteId,
      requestError?.message ??
        "Cotação não encontrada.",
    );
  }


  if (
    request.status ===
    "cancelled"
  ) {
    return fail(
      quoteId,
      "Essa cotação foi cancelada.",
    );
  }


  const {
    data: requestItems,
    error: itemError,
  } =
    await supabase
      .from(
        "quote_supplier_request_items",
      )
      .select(
        "quote_item_id",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "request_id",
        request.id,
      );


  if (
    itemError
  ) {
    return fail(
      quoteId,
      itemError.message,
    );
  }


  const payload:
    Array<{
      quote_item_id:
        string;

      brand_option:
        string | null;

      unit_price:
        number;

      availability:
        string | null;

      delivery:
        string | null;

      notes:
        string | null;
    }> =
    [];


  for (
    const link
    of requestItems ??
    []
  ) {
    const itemId =
      link.quote_item_id;


    const rawPrice =
      text(
        formData.get(
          `unit_price__${itemId}`,
        ),
      );


    const unitPrice =
      parseMoney(
        rawPrice,
      );


    /*
     * Campo vazio:
     * fornecedor nao cotou este item.
     */
    if (
      unitPrice ===
      null
    ) {
      continue;
    }


    if (
      unitPrice <=
      0
    ) {
      return fail(
        quoteId,
        "O preço unitário deve ser maior que zero.",
      );
    }


    payload.push({
      quote_item_id:
        itemId,

      brand_option:
        text(
          formData.get(
            `brand__${itemId}`,
          ),
        ) ||
        null,

      unit_price:
        unitPrice,

      availability:
        text(
          formData.get(
            `availability__${itemId}`,
          ),
        ) ||
        null,

      delivery:
        text(
          formData.get(
            `delivery__${itemId}`,
          ),
        ) ||
        null,

      notes:
        text(
          formData.get(
            `notes__${itemId}`,
          ),
        ) ||
        null,
    });
  }


  if (
    payload.length ===
    0
  ) {
    return fail(
      quoteId,
      "Informe pelo menos um preço retornado pelo fornecedor.",
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "save_supplier_response",
      {
        target_org_id:
          organization.id,

        target_request_id:
          requestId,

        target_items:
          payload,

        target_delivery:
          text(
            formData.get(
              "response_delivery",
            ),
          ) ||
          null,

        target_notes:
          text(
            formData.get(
              "response_notes",
            ),
          ) ||
          null,
      },
    );


  if (error) {
    return fail(
      quoteId,
      `Não foi possível salvar a resposta: ${error.message}`,
    );
  }


  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/cotacoes",
  );

  revalidatePath(
    `/dashboard/cotacoes/${quoteId}`,
  );

  revalidatePath(
    `/dashboard/cotacoes/${quoteId}/respostas`,
  );


  return success(
    quoteId,
    "Resposta do fornecedor salva.",
  );
}


export async function chooseSupplierForItemAction(
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


  const quoteItemId =
    text(
      formData.get(
        "quote_item_id",
      ),
    );


  const requestId =
    text(
      formData.get(
        "request_id",
      ),
    );


  if (
    !quoteId ||
    !quoteItemId ||
    !requestId
  ) {
    redirect(
      "/dashboard/cotacoes",
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "award_supplier_quote_item",
      {
        target_org_id:
          organization.id,

        target_quote_item_id:
          quoteItemId,

        target_request_id:
          requestId,
      },
    );


  if (error) {
    return fail(
      quoteId,
      `Não foi possível escolher o fornecedor: ${error.message}`,
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

  revalidatePath(
    `/dashboard/cotacoes/${quoteId}/respostas`,
  );


  return success(
    quoteId,
    "Fornecedor escolhido para a peça.",
  );
}


export async function finalizePurchasesAction(
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


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "finalize_quote_supplier_awards",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,
      },
    );


  if (error) {
    return fail(
      quoteId,
      `Não foi possível aprovar as compras: ${error.message}`,
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

  revalidatePath(
    `/dashboard/cotacoes/${quoteId}/respostas`,
  );


  revalidatePath(
    "/dashboard/comercial",
  );

  revalidatePath(
    `/dashboard/comercial/${quoteId}`,
  );


  redirect(
    `/dashboard/comercial/${quoteId}?ok=${encodeURIComponent(
      `${data ?? 0} item(ns) confirmado(s). Fornecedores definidos. Agora registre a decisão do cliente.`,
    )}`,
  );
}