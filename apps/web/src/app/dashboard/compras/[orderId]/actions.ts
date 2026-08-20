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


function fail(
  orderId:
    string,

  message:
    string,
): never {

  redirect(
    `/dashboard/compras/${orderId}?error=${encodeURIComponent(
      message,
    )}`,
  );
}


function success(
  orderId:
    string,

  message:
    string,
): never {

  redirect(
    `/dashboard/compras/${orderId}?ok=${encodeURIComponent(
      message,
    )}`,
  );
}


async function refresh(
  quoteId:
    string,

  orderId:
    string,
) {

  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/compras",
  );

  revalidatePath(
    `/dashboard/compras/${orderId}`,
  );

  revalidatePath(
    "/dashboard/orcamentos",
  );

  revalidatePath(
    `/dashboard/orcamentos/${quoteId}`,
  );
}


export async function markOrderOrderedAction(
  formData:
    FormData,
): Promise<never> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const orderId =
    text(
      formData.get(
        "order_id",
      ),
    );


  const quoteId =
    text(
      formData.get(
        "quote_id",
      ),
    );


  if (
    !orderId ||
    !quoteId
  ) {

    redirect(
      "/dashboard/compras",
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "mark_purchase_order_ordered",
      {
        target_org_id:
          organization.id,

        target_order_id:
          orderId,
      },
    );


  if (error) {

    return fail(
      orderId,
      `Não foi possível marcar o pedido: ${error.message}`,
    );
  }


  await refresh(
    quoteId,
    orderId,
  );


  return success(
    orderId,
    "Pedido marcado como realizado.",
  );
}


export async function receiveItemAction(
  formData:
    FormData,
): Promise<never> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const orderId =
    text(
      formData.get(
        "order_id",
      ),
    );


  const quoteId =
    text(
      formData.get(
        "quote_id",
      ),
    );


  const itemId =
    text(
      formData.get(
        "item_id",
      ),
    );


  if (
    !orderId ||
    !quoteId ||
    !itemId
  ) {

    redirect(
      "/dashboard/compras",
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "receive_purchase_order_item",
      {
        target_org_id:
          organization.id,

        target_order_item_id:
          itemId,
      },
    );


  if (error) {

    return fail(
      orderId,
      `Não foi possível receber a peça: ${error.message}`,
    );
  }


  await refresh(
    quoteId,
    orderId,
  );


  return success(
    orderId,
    "Peça recebida.",
  );
}


export async function receiveAllAction(
  formData:
    FormData,
): Promise<never> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const orderId =
    text(
      formData.get(
        "order_id",
      ),
    );


  const quoteId =
    text(
      formData.get(
        "quote_id",
      ),
    );


  if (
    !orderId ||
    !quoteId
  ) {

    redirect(
      "/dashboard/compras",
    );
  }


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "receive_purchase_order_all",
      {
        target_org_id:
          organization.id,

        target_order_id:
          orderId,
      },
    );


  if (error) {

    return fail(
      orderId,
      `Não foi possível receber o pedido: ${error.message}`,
    );
  }


  await refresh(
    quoteId,
    orderId,
  );


  return success(
    orderId,
    `${data ?? 0} item(ns) recebido(s).`,
  );
}