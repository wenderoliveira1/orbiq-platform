"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentContext } from "../../_lib/current-organization";
import type { QuoteErrorCode } from "./quote-errors";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function parseMileage(raw: string): number | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/\D/g, "");

  if (!normalized) {
    return null;
  }

  const value = Number(normalized);

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}

function failure(code: QuoteErrorCode): never {
  redirect(`/dashboard/orcamentos/novo?error=${code}`);
}

export async function createQuoteV2Action(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();

  const customerId = text(formData.get("customer_id"));
  const vehicleId = text(formData.get("vehicle_id"));
  const priority = text(formData.get("priority")) || "normal";
  const mileage = parseMileage(text(formData.get("mileage")));
  const notes = text(formData.get("notes"));
  const servicesRaw = text(formData.get("services_json"));
  const itemsRaw = text(formData.get("items_json"));

  if (!customerId) {
    return failure("customer_required");
  }

  if (!vehicleId) {
    return failure("vehicle_required");
  }

  if (mileage === null) {
    return failure("mileage_required");
  }

  let services;
  let items;

  try {
    services = JSON.parse(servicesRaw || "[]");
    items = JSON.parse(itemsRaw || "[]");
  } catch {
    return failure("payload_invalid");
  }

  if (!Array.isArray(services) || services.length === 0) {
    return failure("service_required");
  }

  if (!Array.isArray(items)) {
    return failure("items_invalid");
  }

  const { data, error } = await supabase.rpc("create_quote_v2", {
    target_org_id: organization.id,
    target_customer_id: customerId,
    target_vehicle_id: vehicleId,
    target_priority: priority,
    target_mileage: mileage,
    target_notes: notes,
    services,
    items,
  });

  if (error) {
    return failure("save_failed");
  }

  const created = data?.[0];

  if (!created || !created.quote_id) {
    return failure("result_invalid");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard/cotacoes");
  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/execucao");

  redirect(`/dashboard/orcamentos/${created.quote_id}?created=1`);
}
