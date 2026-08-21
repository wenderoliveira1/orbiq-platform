"use server";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";


function token(
  formData:
    FormData,
): string {

  return String(
    formData.get(
      "token",
    ) ??
    "",
  ).trim();
}


export async function acceptInviteAction(
  formData:
    FormData,
): Promise<never> {

  const inviteToken =
    token(
      formData,
    );


  if (!inviteToken) {

    redirect(
      "/",
    );
  }


  const supabase =
    await createClient();


  const {
    error,
  } =
    await supabase.rpc(
      "accept_organization_invite",
      {
        target_token:
          inviteToken,
      },
    );


  if (error) {

    redirect(
      `/convite/${inviteToken}?error=${encodeURIComponent(
        error.message,
      )}`,
    );
  }


  redirect(
    "/dashboard/equipe?message=" +
    encodeURIComponent(
      "Convite aceito. Bem-vindo à equipe!",
    ),
  );
}


export async function leaveInviteSessionAction(
  formData:
    FormData,
): Promise<never> {

  const inviteToken =
    token(
      formData,
    );


  const supabase =
    await createClient();


  await supabase.auth.signOut();


  const next =
    `/convite/${inviteToken}`;


  redirect(
    "/login?next=" +
    encodeURIComponent(
      next,
    ),
  );
}