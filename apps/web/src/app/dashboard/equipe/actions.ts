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


function teamError(
  message:
    string,
): never {

  redirect(
    "/dashboard/equipe?error=" +
    encodeURIComponent(
      message,
    ),
  );
}


function teamMessage(
  message:
    string,
): never {

  redirect(
    "/dashboard/equipe?message=" +
    encodeURIComponent(
      message,
    ),
  );
}


export async function createInviteAction(
  formData:
    FormData,
): Promise<never> {

  const email =
    text(
      formData.get(
        "email",
      ),
    );


  const role =
    text(
      formData.get(
        "role",
      ),
    );


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
      "create_organization_invite",
      {
        target_org_id:
          organization.id,

        target_email:
          email,

        target_role:
          role,
      },
    );


  if (error) {

    return teamError(
      error.message,
    );
  }


  const result =
    data as unknown as {
      token?: string;
    };


  if (
    !result?.token
  ) {

    return teamError(
      "O banco não retornou o token do convite.",
    );
  }


  revalidatePath(
    "/dashboard/equipe",
  );


  redirect(
    "/dashboard/equipe?invite=" +
    encodeURIComponent(
      result.token,
    ) +
    "&invite_email=" +
    encodeURIComponent(
      email,
    ),
  );
}


export async function updateMemberRoleAction(
  formData:
    FormData,
): Promise<never> {

  const userId =
    text(
      formData.get(
        "user_id",
      ),
    );


  const role =
    text(
      formData.get(
        "role",
      ),
    );


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    error,
  } =
    await supabase.rpc(
      "update_organization_member_role",
      {
        target_org_id:
          organization.id,

        target_user_id:
          userId,

        target_role:
          role,
      },
    );


  if (error) {

    return teamError(
      error.message,
    );
  }


  revalidatePath(
    "/dashboard/equipe",
  );


  return teamMessage(
    "Cargo atualizado.",
  );
}


export async function setMemberStatusAction(
  formData:
    FormData,
): Promise<never> {

  const userId =
    text(
      formData.get(
        "user_id",
      ),
    );


  const status =
    text(
      formData.get(
        "status",
      ),
    );


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    error,
  } =
    await supabase.rpc(
      "set_organization_member_status",
      {
        target_org_id:
          organization.id,

        target_user_id:
          userId,

        target_status:
          status,
      },
    );


  if (error) {

    return teamError(
      error.message,
    );
  }


  revalidatePath(
    "/dashboard/equipe",
  );


  return teamMessage(
    status ===
    "active"
      ? "Funcionário reativado."
      : "Funcionário desativado.",
  );
}


export async function revokeInviteAction(
  formData:
    FormData,
): Promise<never> {

  const inviteId =
    text(
      formData.get(
        "invite_id",
      ),
    );


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    error,
  } =
    await supabase.rpc(
      "revoke_organization_invite",
      {
        target_org_id:
          organization.id,

        target_invite_id:
          inviteId,
      },
    );


  if (error) {

    return teamError(
      error.message,
    );
  }


  revalidatePath(
    "/dashboard/equipe",
  );


  return teamMessage(
    "Convite revogado.",
  );
}