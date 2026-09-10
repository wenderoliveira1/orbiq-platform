"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentContext } from "../../_lib/current-organization";
import type { QuoteErrorCode } from "./quote-errors";
import { isUuid, parseQuotePayload } from "./quote-payload";

const MAX_ID_CHARS = 64;
const MAX_PRIORITY_CHARS = 32;
const MAX_MILEAGE_CHARS = 32;
const MAX_NOTES_CHARS = 4_000;
const MAX_SERVICES_JSON_CHARS = 128_000;
const MAX_ITEMS_JSON_CHARS = 512_000;

function failure(code: QuoteErrorCode): never {
  redirect(`/dashboard/orcamentos/novo?error=${code}`);
}

function singleRawText(formData: FormData, name: string): string {
  const values = formData.getAll(name);
  if (values.length !== 1 || typeof values[0] !== "string") return failure("payload_invalid");
  return values[0];
}

function parseMileage(raw: string): number | null {
  if (!raw) return null;
  const normalized = raw.replace(/\D/g, "");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 9_999_999) return null;
  return Math.trunc(value);
}

function upper(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR");
}

export async function saveServiceCatalogAction(
  category: string,
  description: string,
  laborAmount: number,
): Promise<string> {
  const { supabase, organization } = await getCurrentContext();
  const normalizedCategory = upper(category);
  const normalizedDescription = upper(description);
  if (
    !normalizedCategory ||
    normalizedDescription.length < 2 ||
    !Number.isFinite(laborAmount) ||
    laborAmount < 0
  ) {
    throw new Error("Dados do serviço inválidos.");
  }
  const { data, error } = await supabase.rpc("save_service_catalog", {
    target_org_id: organization.id,
    target_category: normalizedCategory,
    target_description: normalizedDescription,
    target_labor_amount: Math.round(laborAmount * 100) / 100,
  });
  if (error || !data) throw new Error("Não foi possível salvar o serviço no catálogo.");
  revalidatePath("/dashboard/orcamentos/novo");
  return String(data);
}

export async function saveServiceLaborAction(serviceId: string, amount: number): Promise<void> {
  const { supabase, organization } = await getCurrentContext();
  if (!isUuid(serviceId) || !Number.isFinite(amount) || amount < 0 || amount > 999_999_999) {
    throw new Error("Valor de mão de obra inválido.");
  }
  const { error } = await supabase
    .from("service_catalog")
    .update({ default_labor_amount: Math.round(amount * 100) / 100 })
    .eq("id", serviceId)
    .eq("organization_id", organization.id);
  if (error) throw new Error("Não foi possível salvar a mão de obra.");
  revalidatePath("/dashboard/orcamentos/novo");
}

export async function createQuoteV2Action(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const customerIdRaw = singleRawText(formData, "customer_id");
  const vehicleIdRaw = singleRawText(formData, "vehicle_id");
  const priorityInput = singleRawText(formData, "priority");
  const mileageRaw = singleRawText(formData, "mileage");
  const notesRaw = singleRawText(formData, "notes");
  const servicesInput = singleRawText(formData, "services_json");
  const itemsInput = singleRawText(formData, "items_json");

  if (
    customerIdRaw.length > MAX_ID_CHARS ||
    vehicleIdRaw.length > MAX_ID_CHARS ||
    priorityInput.length > MAX_PRIORITY_CHARS ||
    mileageRaw.length > MAX_MILEAGE_CHARS ||
    notesRaw.length > MAX_NOTES_CHARS ||
    servicesInput.length > MAX_SERVICES_JSON_CHARS ||
    itemsInput.length > MAX_ITEMS_JSON_CHARS
  ) {
    return failure("payload_invalid");
  }

  const customerId = customerIdRaw.trim();
  const vehicleId = vehicleIdRaw.trim();
  const priorityRaw = priorityInput.trim() || "normal";
  const mileage = parseMileage(mileageRaw.trim());
  const notes = upper(notesRaw);
  const servicesRaw = servicesInput.trim();
  const itemsRaw = itemsInput.trim();

  if (!customerId || !isUuid(customerId)) return failure("customer_required");
  if (!vehicleId || !isUuid(vehicleId)) return failure("vehicle_required");
  if (mileage === null) return failure("mileage_required");

  const payload = parseQuotePayload(servicesRaw, itemsRaw, priorityRaw);
  if (!payload) return failure("payload_invalid");

  for (const service of payload.services) {
    if (service.service_catalog_id === null) {
      const { error: catalogError } = await supabase.rpc("save_service_catalog", {
        target_org_id: organization.id,
        target_category: upper(service.category),
        target_description: upper(service.description),
        target_labor_amount: service.labor_amount,
      });
      if (catalogError) return failure("save_failed");
    }
  }

  const { data, error } = await supabase.rpc("create_quote_with_quantities", {
    target_org_id: organization.id,
    target_customer_id: customerId,
    target_vehicle_id: vehicleId,
    target_priority: payload.priority,
    target_mileage: mileage,
    target_notes: notes,
    services: payload.services,
    items: payload.items,
  });
  if (error) return failure("save_failed");
  const created = data?.[0];
  if (!created || !created.quote_id) return failure("result_invalid");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard/cotacoes");
  revalidatePath("/dashboard/comercial");
  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/execucao");

  const hasManualPrice = payload.items.some((item) => item.chosen_amount !== null);
  if (hasManualPrice) {
    redirect(`/dashboard/comercial/${created.quote_id}?ok=${encodeURIComponent("Orçamento criado com preço direto. Revise a venda e salve para enviar ao cliente.")}`);
  }

  redirect(`/dashboard/orcamentos/${created.quote_id}?created=1`);
}
