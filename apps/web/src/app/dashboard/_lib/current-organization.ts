import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

export async function getCurrentContext() {
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
    .select("organization_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Falha ao localizar a oficina ativa: ${membershipError.message}`,
    );
  }

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", membership.organization_id)
    .single();

  if (organizationError || !organization) {
    throw new Error(
      `Falha ao carregar a oficina: ${
        organizationError?.message ?? "oficina não encontrada"
      }`,
    );
  }

  return {
    supabase,
    user,
    membership,
    organization,
  };
}