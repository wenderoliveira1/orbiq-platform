"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizationCookieOptions,
} from "@/lib/organization-context";

import { createClient } from "../../lib/supabase/server";

export type SwitchOrganizationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

function switchFailure(error: string): SwitchOrganizationResult {
  return {
    ok: false,
    error,
  };
}

export async function switchOrganizationAction(
  formData: FormData,
): Promise<SwitchOrganizationResult> {
  const organizationId = String(
    formData.get("organization_id") ?? "",
  ).trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      organizationId,
    )
  ) {
    return switchFailure("Oficina inválida.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, status")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    return switchFailure(
      "Não foi possível validar o acesso à oficina.",
    );
  }

  if (!membership) {
    return switchFailure(
      "Você não possui acesso a essa oficina.",
    );
  }

  const cookieStore = await cookies();

  cookieStore.set(
    ACTIVE_ORGANIZATION_COOKIE,
    organizationId,
    activeOrganizationCookieOptions(),
  );

  return {
    ok: true,
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  const cookieStore = await cookies();

  cookieStore.delete(ACTIVE_ORGANIZATION_COOKIE);
  await supabase.auth.signOut();

  redirect("/login");
}
