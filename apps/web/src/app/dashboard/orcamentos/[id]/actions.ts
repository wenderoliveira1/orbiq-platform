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

import {
  QUOTE_STATUSES,
} from "../quote-meta";


function text(
  value:
    FormDataEntryValue |
    null,
): string {
  return String(
    value ?? "",
  ).trim();
}


function fail(
  quoteId: string,
  message: string,
): never {
  redirect(
    `/dashboard/orcamentos/${quoteId}?error=${encodeURIComponent(
      message,
    )}`,
  );
}


export async function updateQuoteStatusAction(
  formData: FormData,
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


  const status =
    text(
      formData.get(
        "status",
      ),
    );


  if (!quoteId) {
    redirect(
      "/dashboard/orcamentos",
    );
  }


  const validStatus =
    QUOTE_STATUSES.some(
      (item) =>
        item.value ===
        status,
    );


  if (!validStatus) {
    return fail(
      quoteId,
      "Status inválido.",
    );
  }


  const {
    data,
    error,
  } =
    await supabase
      .from("quotes")
      .update({
        status,
      })
      .eq(
        "id",
        quoteId,
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .select("id")
      .maybeSingle();


  if (error) {
    return fail(
      quoteId,
      `Não foi possível alterar o status: ${error.message}`,
    );
  }


  if (!data) {
    return fail(
      quoteId,
      "Orçamento não encontrado.",
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


  redirect(
    `/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent(
      "Status atualizado.",
    )}`,
  );
}