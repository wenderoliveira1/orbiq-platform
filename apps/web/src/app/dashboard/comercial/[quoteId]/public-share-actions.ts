"use server";

import {
  getCurrentContext,
} from "../../_lib/current-organization";


export async function createPublicLinkAction(
  quoteId:
    string,
): Promise<{
  token?: string;
  error?: string;
}> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "create_quote_public_link",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,
      },
    );


  if (error) {

    return {
      error:
        error.message,
    };
  }


  if (!data) {

    return {
      error:
        "O PostgreSQL não retornou o token.",
    };
  }


  return {
    token:
      data,
  };
}


export async function revokePublicLinkAction(
  quoteId:
    string,
): Promise<{
  ok?: boolean;
  error?: string;
}> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    error,
  } =
    await supabase.rpc(
      "revoke_quote_public_link",
      {
        target_org_id:
          organization.id,

        target_quote_id:
          quoteId,
      },
    );


  if (error) {

    return {
      error:
        error.message,
    };
  }


  return {
    ok:
      true,
  };
}