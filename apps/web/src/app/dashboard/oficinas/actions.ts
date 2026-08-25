"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizationCookieOptions,
} from "@/lib/organization-context";

import { requireCurrentPermission } from "../_lib/permissions";

type CreatedOrganization = {
  organization_id: string;
  name: string;
  slug: string;
  role: string;
};

function text(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "").trim();
}

function optionalText(formData: FormData, field: string): string | null {
  const value = text(formData, field);
  return value || null;
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

function fail(message: string): never {
  redirect(
    `/dashboard/oficinas?error=${encodeURIComponent(message)}`,
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function createAdditionalOrganizationAction(
  formData: FormData,
): Promise<never> {
  const { supabase } = await requireCurrentPermission(
    "organizations.manage",
  );

  const name = text(formData, "name");
  const requestedSlug = text(formData, "slug");
  const slug = slugify(requestedSlug || name);
  const phone = optionalText(formData, "phone");
  const whatsapp = optionalText(formData, "whatsapp");
  const email = optionalText(formData, "email");
  const city = text(formData, "city");
  const state = text(formData, "state").toUpperCase();

  if (name.length < 2 || name.length > 120 || !slug) {
    fail("Informe um nome de oficina válido.");
  }

  if (!phone && !whatsapp) {
    fail("Informe pelo menos um telefone ou WhatsApp da oficina.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("Informe um e-mail válido.");
  }

  if (city.length < 2) {
    fail("Informe a cidade da oficina.");
  }

  if (!/^[A-Z]{2}$/.test(state)) {
    fail("Informe a UF com exatamente 2 letras.");
  }

  const { data, error } = await supabase.rpc(
    "create_additional_organization",
    {
      organization_name: name,
      organization_slug: slug,
      organization_cnpj: optionalText(formData, "cnpj"),
      organization_legal_name: optionalText(formData, "legal_name"),
      organization_phone: phone,
      organization_whatsapp: whatsapp,
      organization_email: email,
      organization_city: city,
      organization_state: state,
    },
  );

  if (error) {
    const normalized = error.message.toLowerCase();
    const duplicated =
      normalized.includes("duplicate") ||
      normalized.includes("unique") ||
      normalized.includes("já existe");

    fail(
      duplicated
        ? "Já existe uma oficina com esse identificador ou CNPJ."
        : error.message,
    );
  }

  const created = data as unknown as CreatedOrganization | null;
  const organizationId = String(
    created?.organization_id ?? "",
  ).trim();

  if (!isUuid(organizationId)) {
    fail(
      "A oficina foi criada, mas não pôde ser ativada. Tente entrar novamente.",
    );
  }

  const cookieStore = await cookies();

  cookieStore.set(
    ACTIVE_ORGANIZATION_COOKIE,
    organizationId,
    activeOrganizationCookieOptions(),
  );

  redirect("/dashboard/oficinas?created=1");
}
