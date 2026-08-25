import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACTIVE_ORGANIZATION_COOKIE,
} from "@/lib/organization-context";

import { createClient } from "../../../lib/supabase/server";

type Membership = {
  organization_id: string;
  role: string;
  status: string;
  created_at: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type AvailableOrganization = Organization & {
  role: string;
};

export async function getCurrentContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("organization_id", { ascending: true });

  if (membershipError) {
    throw new Error(
      `Falha ao localizar as oficinas do usuário: ${membershipError.message}`,
    );
  }

  const memberships = (membershipRows ?? []) as Membership[];

  if (!memberships.length) {
    redirect("/onboarding");
  }

  const organizationIds = memberships.map(
    (membership) => membership.organization_id,
  );

  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .in("id", organizationIds)
    .order("name", { ascending: true });

  if (organizationError) {
    throw new Error(
      `Falha ao carregar as oficinas disponíveis: ${organizationError.message}`,
    );
  }

  const organizations = (organizationRows ?? []) as Organization[];
  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );

  const availableOrganizations: AvailableOrganization[] = memberships
    .map((membership) => {
      const organization = organizationById.get(membership.organization_id);

      if (!organization) {
        return null;
      }

      return {
        ...organization,
        role: membership.role,
      };
    })
    .filter(
      (organization): organization is AvailableOrganization =>
        organization !== null,
    );

  if (!availableOrganizations.length) {
    throw new Error(
      "Nenhuma oficina ativa pôde ser carregada para esta conta.",
    );
  }

  const cookieStore = await cookies();
  const requestedOrganizationId = cookieStore.get(
    ACTIVE_ORGANIZATION_COOKIE,
  )?.value;

  const organization =
    availableOrganizations.find(
      (candidate) => candidate.id === requestedOrganizationId,
    ) ?? availableOrganizations[0];

  const membership = memberships.find(
    (candidate) => candidate.organization_id === organization.id,
  );

  if (!membership) {
    throw new Error(
      "O vínculo da oficina ativa não pôde ser resolvido.",
    );
  }

  if (membership.role === "owner") {
    const { data: settings, error: settingsError } = await supabase
      .from("organization_settings")
      .select("organization_id")
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (settingsError) {
      throw new Error(
        `Falha ao validar a configuração da oficina: ${settingsError.message}`,
      );
    }

    if (!settings) {
      redirect("/onboarding?step=profile");
    }
  }

  return {
    supabase,
    user,
    membership,
    organization,
    availableOrganizations,
  };
}
