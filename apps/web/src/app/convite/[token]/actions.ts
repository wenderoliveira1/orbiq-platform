"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizationCookieOptions,
} from "@/lib/organization-context";
import { createClient } from "@/lib/supabase/server";

function token(formData: FormData): string {
  return String(formData.get("token") ?? "").trim();
}

export async function acceptInviteAction(
  formData: FormData,
): Promise<never> {
  const inviteToken = token(formData);

  if (!inviteToken) {
    redirect("/");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "accept_organization_invite",
    {
      target_token: inviteToken,
    },
  );

  if (error) {
    redirect(
      `/convite/${inviteToken}?error=${encodeURIComponent(error.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: newestMembership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (newestMembership?.organization_id) {
      const cookieStore = await cookies();

      cookieStore.set(
        ACTIVE_ORGANIZATION_COOKIE,
        newestMembership.organization_id,
        activeOrganizationCookieOptions(),
      );
    }
  }

  redirect(
    "/dashboard/equipe?message=" +
      encodeURIComponent("Convite aceito. Bem-vindo à equipe!"),
  );
}

export async function leaveInviteSessionAction(
  formData: FormData,
): Promise<never> {
  const inviteToken = token(formData);
  const supabase = await createClient();
  const cookieStore = await cookies();

  cookieStore.delete(ACTIVE_ORGANIZATION_COOKIE);
  await supabase.auth.signOut();

  const next = `/convite/${inviteToken}`;

  redirect("/login?next=" + encodeURIComponent(next));
}
