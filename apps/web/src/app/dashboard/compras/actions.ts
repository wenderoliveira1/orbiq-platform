"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  getCurrentContext,
} from "../_lib/current-organization";


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
  message:
    string,
): never {

  redirect(
    `/dashboard/compras?error=${encodeURIComponent(
      message,
    )}`,
  );
}


export async function syncPurchaseOrdersAction(
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

    return fail(
      "Orçamento inválido.",
    );
  }


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "sync_quote_purchase_orders",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,
      },
    );


  if (error) {

    return fail(
      `Não foi possível gerar os pedidos: ${error.message}`,
    );
  }


  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/compras",
  );

  revalidatePath(
    "/dashboard/cotacoes",
  );

  revalidatePath(
    `/dashboard/orcamentos/${quoteId}`,
  );


  redirect(
    `/dashboard/compras?ok=${encodeURIComponent(
      `${data ?? 0} pedido(s) sincronizado(s).`,
    )}`,
  );
}