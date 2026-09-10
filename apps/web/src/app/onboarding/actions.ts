"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "").trim();
}

function optionalText(formData: FormData, field: string): string | null {
  const value = text(formData, field);
  return value || null;
}

function numericValue(
  formData: FormData,
  field: string,
  fallback: number,
): number {
  const raw = text(formData, field).replace(",", ".");

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function onboardingError(message: string, step?: "profile"): never {
  const suffix = step === "profile" ? "&step=profile" : "";

  redirect(
    `/onboarding?error=${encodeURIComponent(message)}${suffix}`,
  );
}

export async function createOrganization(formData: FormData): Promise<never> {
  const name = text(formData, "name");
  const cnpj = text(formData, "cnpj");
  const requestedSlug = text(formData, "slug");
  const slug = slugify(requestedSlug || name);

  if (name.length < 2 || !slug) {
    onboardingError("Informe o nome da oficina.");
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = String(authData?.claims?.sub ?? "");

  if (!userId) {
    redirect("/login");
  }

  const { data: existingMembership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    onboardingError(
      `Não foi possível validar sua conta: ${membershipError.message}`,
    );
  }

  if (existingMembership) {
    redirect("/onboarding?step=profile");
  }

  const { error } = await supabase.rpc("create_organization", {
    organization_name: name,
    organization_slug: slug,
    organization_cnpj: cnpj || null,
  });

  if (error) {
    const normalized = error.message.toLowerCase();
    const duplicated =
      normalized.includes("duplicate") || normalized.includes("unique");

    onboardingError(
      duplicated
        ? "Esse identificador de oficina já está em uso."
        : error.message,
    );
  }

  redirect("/onboarding?created=1&step=profile");
}

export async function completeOrganizationSetup(
  formData: FormData,
): Promise<never> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = String(authData?.claims?.sub ?? "");

  if (!userId) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    onboardingError(
      `Não foi possível localizar sua oficina: ${membershipError.message}`,
      "profile",
    );
  }

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, cnpj")
    .eq("id", membership.organization_id)
    .single();

  if (organizationError || !organization) {
    onboardingError(
      `Não foi possível carregar sua oficina: ${
        organizationError?.message ?? "registro não encontrado"
      }`,
      "profile",
    );
  }

  const { data: existingSettings, error: settingsError } = await supabase
    .from("organization_settings")
    .select("organization_id")
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (settingsError) {
    onboardingError(
      `Não foi possível validar a configuração inicial: ${settingsError.message}`,
      "profile",
    );
  }

  if (existingSettings) {
    redirect("/dashboard");
  }

  const phone = optionalText(formData, "phone");
  const whatsapp = optionalText(formData, "whatsapp");
  const email = optionalText(formData, "email");
  const city = optionalText(formData, "city");
  const state = optionalText(formData, "state")?.toUpperCase() ?? null;
  const validityDays = Math.trunc(
    numericValue(formData, "quote_validity_days", 7),
  );
  const partsMargin = numericValue(
    formData,
    "default_parts_margin_percent",
    30,
  );

  if (!phone && !whatsapp) {
    onboardingError(
      "Informe pelo menos um telefone ou WhatsApp da oficina.",
      "profile",
    );
  }

  if (email && !email.includes("@")) {
    onboardingError("Informe um e-mail válido.", "profile");
  }

  if (!city || city.length < 2) {
    onboardingError("Informe a cidade da oficina.", "profile");
  }

  if (!state || state.length !== 2) {
    onboardingError("Informe a UF com 2 caracteres.", "profile");
  }

  if (validityDays < 1 || validityDays > 90) {
    onboardingError(
      "A validade padrão deve ficar entre 1 e 90 dias.",
      "profile",
    );
  }

  if (partsMargin < 0 || partsMargin >= 100) {
    onboardingError(
      "O lucro padrão das peças deve ficar entre 0% e menos de 100% (lucro sobre a venda).",
      "profile",
    );
  }

  const { error } = await supabase.rpc("update_organization_settings", {
    target_org_id: organization.id,
    target_name: organization.name,
    target_cnpj: organization.cnpj,
    target_legal_name: optionalText(formData, "legal_name"),
    target_phone: phone,
    target_whatsapp: whatsapp,
    target_email: email,
    target_postal_code: optionalText(formData, "postal_code"),
    target_address_line: optionalText(formData, "address_line"),
    target_address_number: optionalText(formData, "address_number"),
    target_address_complement: optionalText(formData, "address_complement"),
    target_district: optionalText(formData, "district"),
    target_city: city,
    target_state: state,
    target_quote_validity_days: validityDays,
    target_default_parts_margin_percent: partsMargin,
    target_default_quote_notes: optionalText(formData, "default_quote_notes"),
  });

  if (error) {
    onboardingError(error.message, "profile");
  }

  redirect("/dashboard?welcome=1");
}
