"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizationCookieOptions,
} from "@/lib/organization-context";
import { createClient } from "@/lib/supabase/server";

type AcceptedInvite = {
  organization_id: string;
  organization_name: string;
  role: string;
};

function token(formData: FormData): string {
  return String(formData.get("token") ?? "").trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function acceptInviteAction(
  formData: FormData,
): Promise<never> {
  const inviteToken = token(formData);

  if (!inviteToken) {
    redirect("/");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
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

  const acceptedInvite = data as unknown as AcceptedInvite | null;
  const organizationId = String(
    acceptedInvite?.organization_id ?? "",
  ).trim();

  if (!isUuid(organizationId)) {
    redirect(
      `/convite/${inviteToken}?error=${encodeURIComponent(
        "O convite foi aceito, mas a oficina não pôde ser ativada.",
      )}`,
    );
  }

  const cookieStore = await cookies();

  cookieStore.set(
    ACTIVE_ORGANIZATION_COOKIE,
    organizationId,
    activeOrganizationCookieOptions(),
  );

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
