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

function rawText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function parseMileage(raw: string): number | null {
  if (!raw) return null;

  const normalized = raw.replace(/\D/g, "");
  if (!normalized) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 9_999_999) return null;

  return Math.trunc(value);
}

function failure(code: QuoteErrorCode): never {
  redirect(`/dashboard/orcamentos/novo?error=${code}`);
}

export async function createQuoteV2Action(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();

  const customerIdRaw = rawText(formData.get("customer_id"));
  const vehicleIdRaw = rawText(formData.get("vehicle_id"));
  const priorityInput = rawText(formData.get("priority"));
  const mileageRaw = rawText(formData.get("mileage"));
  const notesRaw = rawText(formData.get("notes"));
  const servicesInput = rawText(formData.get("services_json"));
  const itemsInput = rawText(formData.get("items_json"));

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
  const notes = notesRaw.trim();
  const servicesRaw = servicesInput.trim();
  const itemsRaw = itemsInput.trim();

  if (!customerId || !isUuid(customerId)) return failure("customer_required");
  if (!vehicleId || !isUuid(vehicleId)) return failure("vehicle_required");
  if (mileage === null) return failure("mileage_required");

  const payload = parseQuotePayload(servicesRaw, itemsRaw, priorityRaw);
  if (!payload) return failure("payload_invalid");

  const { data, error } = await supabase.rpc("create_quote_v2", {
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
  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/execucao");

  redirect(`/dashboard/orcamentos/${created.quote_id}?created=1`);
}