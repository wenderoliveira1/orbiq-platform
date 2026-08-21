"use server";

import {
  redirect,
} from "next/navigation";

import {
  createPublicSupabaseClient,
} from "../../../lib/supabase/public";


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
  token:
    string,

  message:
    string,
): never {

  redirect(
    `/orcamento/${token}?error=${encodeURIComponent(
      message,
    )}`,
  );
}


export async function approvePublicQuoteAction(
  formData:
    FormData,
): Promise<never> {

  const token =
    text(
      formData.get(
        "token",
      ),
    );


  if (!token) {

    redirect(
      "/",
    );
  }


  const supabase =
    createPublicSupabaseClient();


  const {
    error,
  } =
    await supabase.rpc(
      "public_decide_quote",
      {
        target_token:
          token,

        target_decision:
          "approved",

        target_reason:
          "",
      },
    );


  if (error) {

    return fail(
      token,
      error.message,
    );
  }


  redirect(
    `/orcamento/${token}?ok=${encodeURIComponent(
      "Orçamento aprovado com sucesso.",
    )}`,
  );
}


export async function rejectPublicQuoteAction(
  formData:
    FormData,
): Promise<never> {

  const token =
    text(
      formData.get(
        "token",
      ),
    );


  const reason =
    text(
      formData.get(
        "reason",
      ),
    );


  if (!token) {

    redirect(
      "/",
    );
  }


  const supabase =
    createPublicSupabaseClient();


  const {
    error,
  } =
    await supabase.rpc(
      "public_decide_quote",
      {
        target_token:
          token,

        target_decision:
          "rejected",

        target_reason:
          reason,
      },
    );


  if (error) {

    return fail(
      token,
      error.message,
    );
  }


  redirect(
    `/orcamento/${token}?ok=${encodeURIComponent(
      "Sua decisão foi registrada.",
    )}`,
  );
}