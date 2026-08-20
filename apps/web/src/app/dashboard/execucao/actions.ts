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
    `/dashboard/execucao?error=${encodeURIComponent(
      message,
    )}`,
  );
}


export async function createWorkOrderAction(
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
      "sync_quote_work_order",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,
      },
    );


  if (
    error ||
    !data
  ) {

    return fail(
      `Não foi possível gerar a OS: ${
        error?.message ??
        "OS não criada."
      }`,
    );
  }


  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/execucao",
  );

  revalidatePath(
    `/dashboard/orcamentos/${quoteId}`,
  );


  redirect(
    `/dashboard/execucao/${data}?ok=${encodeURIComponent(
      "Ordem de Serviço preparada.",
    )}`,
  );
}