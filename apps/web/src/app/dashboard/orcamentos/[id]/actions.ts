"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentContext } from "../../_lib/current-organization";
import { QUOTE_STATUSES } from "../quote-meta";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function fail(quoteId: string, message: string): never {
  redirect(`/dashboard/orcamentos/${quoteId}?error=${encodeURIComponent(message)}`);
}

async function refreshQuoteTotal(
  supabase: Awaited<ReturnType<typeof getCurrentContext>>["supabase"],
  organizationId: string,
  quoteId: string,
): Promise<string | null> {
  const [servicesResult, itemsResult] = await Promise.all([
    supabase.from("quote_services").select("labor_amount, quantity").eq("organization_id", organizationId).eq("quote_id", quoteId),
    supabase.from("quote_items").select("chosen_amount, quantity").eq("organization_id", organizationId).eq("quote_id", quoteId),
  ]);
  if (servicesResult.error) return servicesResult.error.message;
  if (itemsResult.error) return itemsResult.error.message;
  const laborTotal = (servicesResult.data ?? []).reduce((total, service) => total + Number(service.labor_amount ?? 0) * Number(service.quantity ?? 1), 0);
  const partsTotal = (itemsResult.data ?? []).reduce((total, item) => total + Number(item.chosen_amount ?? 0), 0);
  const { error } = await supabase.from("quotes").update({ final_amount: Math.round((laborTotal + partsTotal) * 100) / 100 }).eq("id", quoteId).eq("organization_id", organizationId);
  return error?.message ?? null;
}


async function assertQuoteNotCommerciallyLocked(
  supabase: Awaited<ReturnType<typeof getCurrentContext>>["supabase"],
  organizationId: string,
  quoteId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select("commercial_status")
    .eq("id", quoteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return `Não foi possível validar o orçamento: ${error.message}`;
  if (!data) return "Orçamento não encontrado.";
  if (data.commercial_status === "approved") {
    return 'Orçamento bloqueado após aprovação comercial. Digite "sim" em Reabrir para editar.';
  }
  return null;
}

function refreshQuotePaths(quoteId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard/cotacoes");
  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/execucao");
  revalidatePath(`/dashboard/orcamentos/${quoteId}`);
}

export async function updateQuoteStatusAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const status = text(formData.get("status"));
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  const validStatus = QUOTE_STATUSES.some((item) => item.value === status);
  if (!validStatus) return fail(quoteId, "Status inválido.");
  const { data, error } = await supabase.from("quotes").update({ status }).eq("id", quoteId).eq("organization_id", organization.id).select("id").maybeSingle();
  if (error) return fail(quoteId, `Não foi possível alterar o status: ${error.message}`);
  if (!data) return fail(quoteId, "Orçamento não encontrado.");
  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Status atualizado.")}`);
}

export async function deleteQuoteServiceAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const serviceId = text(formData.get("service_id"));
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (!serviceId) return fail(quoteId, "Serviço inválido.");
  const { data, error } = await supabase.from("quote_services").delete().eq("id", serviceId).eq("quote_id", quoteId).eq("organization_id", organization.id).select("id").maybeSingle();
  if (error) return fail(quoteId, `Não foi possível excluir o serviço: ${error.message}`);
  if (!data) return fail(quoteId, "Serviço não encontrado.");
  const totalError = await refreshQuoteTotal(supabase, organization.id, quoteId);
  if (totalError) return fail(quoteId, `Serviço excluído, mas não foi possível atualizar o total: ${totalError}`);
  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Serviço excluído e valor atualizado.")}`);
}

export async function addQuoteServiceAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const catalogId = text(formData.get("service_catalog_id"));
  let category = text(formData.get("category")).toLocaleUpperCase("pt-BR");
  let description = text(formData.get("description")).toLocaleUpperCase("pt-BR");
  const laborRaw = text(formData.get("labor_amount"));
  const quantityRaw = text(formData.get("quantity"));
  let needsPart = formData.get("needs_part") === "on";
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);

  let unitLabor: number | null = null;
  if (catalogId) {
    const { data: catalog, error: catalogError } = await supabase
      .from("service_catalog")
      .select("id, category, description, default_labor_amount, requires_part")
      .eq("id", catalogId)
      .eq("organization_id", organization.id)
      .eq("active", true)
      .maybeSingle();
    if (catalogError) return fail(quoteId, `Não foi possível carregar o catálogo: ${catalogError.message}`);
    if (!catalog) return fail(quoteId, "Serviço do catálogo não encontrado.");
    if (!category) category = String(catalog.category ?? "GERAL").toLocaleUpperCase("pt-BR");
    if (!description) description = String(catalog.description ?? "").toLocaleUpperCase("pt-BR");
    unitLabor = Number(catalog.default_labor_amount ?? 0);
    if (formData.get("needs_part") === null) needsPart = Boolean(catalog.requires_part);
  }

  if (!description) return fail(quoteId, "Informe a descrição do serviço ou escolha no catálogo.");
  if (description.length > 500) return fail(quoteId, "A descrição do serviço é muito longa.");
  if (category.length > 120) return fail(quoteId, "A categoria do serviço é muito longa.");

  if (laborRaw) {
    const normalizedLabor = laborRaw.includes(",")
      ? laborRaw.replace(/\./g, "").replace(",", ".")
      : laborRaw;
    unitLabor = Number(normalizedLabor);
  } else if (unitLabor === null) {
    unitLabor = 0;
  }

  const normalizedQuantity = quantityRaw.includes(",")
    ? quantityRaw.replace(/\./g, "").replace(",", ".")
    : quantityRaw;
  const quantity = normalizedQuantity ? Number(normalizedQuantity) : 1;
  if (!Number.isFinite(unitLabor) || unitLabor < 0 || unitLabor > 1_000_000) return fail(quoteId, "Valor de mão de obra inválido.");
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) return fail(quoteId, "Quantidade do serviço inválida.");

  const { data: quote, error: quoteError } = await supabase.from("quotes").select("id").eq("id", quoteId).eq("organization_id", organization.id).maybeSingle();
  if (quoteError) return fail(quoteId, `Não foi possível validar o orçamento: ${quoteError.message}`);
  if (!quote) return fail(quoteId, "Orçamento não encontrado.");

  const { error } = await supabase.from("quote_services").insert({
    organization_id: organization.id,
    quote_id: quoteId,
    category: category || "GERAL",
    description,
    needs_part: needsPart,
    quantity,
    labor_amount: Math.round(unitLabor * 100) / 100,
  });
  if (error) return fail(quoteId, `Não foi possível adicionar o serviço: ${error.message}`);

  const totalError = await refreshQuoteTotal(supabase, organization.id, quoteId);
  if (totalError) return fail(quoteId, `Serviço adicionado, mas não foi possível atualizar o total: ${totalError}`);
  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Serviço adicionado e valor atualizado.")}`);
}

export async function updateQuoteServiceQuantityAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const serviceId = text(formData.get("service_id"));
  const quantityRaw = text(formData.get("quantity"));
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (!serviceId) return fail(quoteId, "Serviço inválido.");

  const normalizedQuantity = quantityRaw.includes(",")
    ? quantityRaw.replace(/\./g, "").replace(",", ".")
    : quantityRaw;
  const quantity = Number(normalizedQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
    return fail(quoteId, "Quantidade do serviço inválida.");
  }

  const { data, error } = await supabase
    .from("quote_services")
    .update({ quantity })
    .eq("id", serviceId)
    .eq("quote_id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(quoteId, `Não foi possível atualizar a quantidade: ${error.message}`);
  if (!data) return fail(quoteId, "Serviço não encontrado.");

  const totalError = await refreshQuoteTotal(supabase, organization.id, quoteId);
  if (totalError) return fail(quoteId, `Quantidade atualizada, mas não foi possível atualizar o total: ${totalError}`);
  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Quantidade do serviço atualizada.")}`);
}

export async function updateQuoteItemQuantityAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const itemId = text(formData.get("item_id"));
  const quantityRaw = text(formData.get("quantity"));
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (!itemId) return fail(quoteId, "Item inválido.");

  const normalizedQuantity = quantityRaw.includes(",")
    ? quantityRaw.replace(/\./g, "").replace(",", ".")
    : quantityRaw;
  const quantity = Number(normalizedQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
    return fail(quoteId, "Quantidade do item inválida.");
  }

  const { data, error } = await supabase
    .from("quote_items")
    .update({ quantity })
    .eq("id", itemId)
    .eq("quote_id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(quoteId, `Não foi possível atualizar a quantidade: ${error.message}`);
  if (!data) return fail(quoteId, "Item não encontrado.");

  const totalError = await refreshQuoteTotal(supabase, organization.id, quoteId);
  if (totalError) return fail(quoteId, `Quantidade atualizada, mas não foi possível atualizar o total: ${totalError}`);
  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Quantidade do item atualizada.")}`);
}


export async function updateQuoteServiceDescriptionAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const serviceId = text(formData.get("service_id"));
  const description = text(formData.get("description")).toLocaleUpperCase("pt-BR");
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (!serviceId) return fail(quoteId, "Serviço inválido.");
  if (description.length < 2) return fail(quoteId, "Informe a descrição do serviço.");
  if (description.length > 300) return fail(quoteId, "A descrição do serviço é muito longa.");

  const { data, error } = await supabase
    .from("quote_services")
    .update({ description })
    .eq("id", serviceId)
    .eq("quote_id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(quoteId, `Não foi possível atualizar a descrição: ${error.message}`);
  if (!data) return fail(quoteId, "Serviço não encontrado.");

  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Descrição do serviço atualizada.")}`);
}

export async function updateQuoteItemDescriptionAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const itemId = text(formData.get("item_id"));
  const description = text(formData.get("description")).toLocaleUpperCase("pt-BR");
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (!itemId) return fail(quoteId, "Item inválido.");
  if (description.length < 2) return fail(quoteId, "Informe a descrição da peça.");
  if (description.length > 300) return fail(quoteId, "A descrição da peça é muito longa.");

  const { data, error } = await supabase
    .from("quote_items")
    .update({ description })
    .eq("id", itemId)
    .eq("quote_id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(quoteId, `Não foi possível atualizar a descrição: ${error.message}`);
  if (!data) return fail(quoteId, "Item não encontrado.");

  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Descrição da peça atualizada.")}`);
}


export async function updateQuoteServiceLaborAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const serviceId = text(formData.get("service_id"));
  const laborRaw = text(formData.get("labor_amount"));
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (!serviceId) return fail(quoteId, "Serviço inválido.");

  const normalizedLabor = laborRaw.includes(",")
    ? laborRaw.replace(/\./g, "").replace(",", ".")
    : laborRaw;
  const unitLabor = Number(normalizedLabor);
  if (!Number.isFinite(unitLabor) || unitLabor < 0 || unitLabor > 1_000_000) {
    return fail(quoteId, "Valor de mão de obra inválido.");
  }

  const { data, error } = await supabase
    .from("quote_services")
    .update({ labor_amount: Math.round(unitLabor * 100) / 100 })
    .eq("id", serviceId)
    .eq("quote_id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(quoteId, `Não foi possível atualizar a mão de obra: ${error.message}`);
  if (!data) return fail(quoteId, "Serviço não encontrado.");

  const totalError = await refreshQuoteTotal(supabase, organization.id, quoteId);
  if (totalError) return fail(quoteId, `Mão de obra atualizada, mas não foi possível atualizar o total: ${totalError}`);
  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Mão de obra atualizada.")}`);
}


export async function updateQuoteItemPriceAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const itemId = text(formData.get("item_id"));
  const costUnitRaw = text(formData.get("cost_unit_amount"));
  const saleUnitRaw = text(formData.get("sale_unit_amount"));
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (!itemId) return fail(quoteId, "Item inválido.");

  const { data: item, error: itemError } = await supabase
    .from("quote_items")
    .select("id, quantity")
    .eq("id", itemId)
    .eq("quote_id", quoteId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (itemError) return fail(quoteId, `Não foi possível validar a peça: ${itemError.message}`);
  if (!item) return fail(quoteId, "Item não encontrado.");

  const quantity = Number(item.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return fail(quoteId, "Quantidade da peça inválida.");
  }

  function parseMoneyField(raw: string): number | null {
    if (!raw) return null;
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const value = Number(normalized);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return Number.NaN;
    return Math.round(value * 100) / 100;
  }

  const costUnit = parseMoneyField(costUnitRaw);
  if (costUnit !== null && Number.isNaN(costUnit)) {
    return fail(quoteId, "Custo unitário inválido.");
  }
  const saleUnit = parseMoneyField(saleUnitRaw);
  if (saleUnit !== null && Number.isNaN(saleUnit)) {
    return fail(quoteId, "Preço de venda unitário inválido.");
  }
  if (costUnit === null && saleUnit !== null) {
    return fail(quoteId, "Informe o custo unitário antes da venda.");
  }

  const chosenAmount =
    costUnit === null ? null : Math.round(costUnit * quantity * 100) / 100;
  const saleTotal =
    saleUnit === null ? null : Math.round(saleUnit * quantity * 100) / 100;

  const { data, error } = await supabase
    .from("quote_items")
    .update({
      chosen_amount: chosenAmount,
      sale_unit_amount: saleUnit,
      sale_total_amount: saleTotal,
      purchase_status: chosenAmount !== null ? "approved" : "pending",
    })
    .eq("id", itemId)
    .eq("quote_id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(quoteId, `Não foi possível atualizar o preço: ${error.message}`);
  if (!data) return fail(quoteId, "Item não encontrado.");

  const totalError = await refreshQuoteTotal(supabase, organization.id, quoteId);
  if (totalError) return fail(quoteId, `Preço atualizado, mas não foi possível atualizar o total: ${totalError}`);
  refreshQuotePaths(quoteId);
  revalidatePath(`/dashboard/comercial/${quoteId}`);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Preço da peça atualizado.")}`);
}

export async function updateQuoteNotesAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const notes = text(formData.get("notes")).toLocaleUpperCase("pt-BR");
  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (notes.length > 4000) return fail(quoteId, "Observações muito longas.");

  const { data, error } = await supabase
    .from("quotes")
    .update({ notes: notes || null })
    .eq("id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(quoteId, `Não foi possível atualizar as observações: ${error.message}`);
  if (!data) return fail(quoteId, "Orçamento não encontrado.");

  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Observações atualizadas.")}`);
}

function upper(value: FormDataEntryValue | null) {
  return text(value).toLocaleUpperCase("pt-BR");
}

function optionalUpper(value: FormDataEntryValue | null) {
  const result = upper(value);
  return result.length ? result : null;
}

function normalizePlate(value: FormDataEntryValue | null) {
  return text(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function parseMileage(raw: string): number | null {
  if (!raw) return null;
  const normalized = raw.replace(/\D/g, "");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 9_999_999) return null;
  return Math.trunc(value);
}

export async function updateQuoteIdentityAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const customerId = text(formData.get("customer_id"));
  const vehicleId = text(formData.get("vehicle_id"));
  const section = text(formData.get("section"));

  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, customer_id, vehicle_id")
    .eq("id", quoteId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (quoteError) return fail(quoteId, `Não foi possível validar o orçamento: ${quoteError.message}`);
  if (!quote) return fail(quoteId, "Orçamento não encontrado.");
  if (customerId && customerId !== quote.customer_id) return fail(quoteId, "Cliente inválido para este orçamento.");
  if (vehicleId && vehicleId !== quote.vehicle_id) return fail(quoteId, "Veículo inválido para este orçamento.");

  if (section === "customer") {
    const name = upper(formData.get("customer_name"));
    const phone = optionalUpper(formData.get("customer_phone"));
    const email = optionalUpper(formData.get("customer_email"));
    if (!quote.customer_id) return fail(quoteId, "Cliente não localizado.");
    if (name.length < 2) return fail(quoteId, "Informe o nome do cliente.");
    if (name.length > 180) return fail(quoteId, "Nome do cliente muito longo.");
    if (phone && phone.length > 40) return fail(quoteId, "Telefone inválido.");
    if (email && email.length > 180) return fail(quoteId, "E-mail inválido.");

    const { data, error } = await supabase
      .from("customers")
      .update({ name, phone, email })
      .eq("id", quote.customer_id)
      .eq("organization_id", organization.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(quoteId, `Não foi possível atualizar o cliente: ${error.message}`);
    if (!data) return fail(quoteId, "Cliente não encontrado.");

    refreshQuotePaths(quoteId);
    revalidatePath("/dashboard/clientes");
    redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Cliente atualizado.")}`);
  }

  if (section === "vehicle") {
    const plate = normalizePlate(formData.get("plate"));
    const brand = optionalUpper(formData.get("brand"));
    const model = upper(formData.get("model"));
    const version = optionalUpper(formData.get("version"));
    const yearRaw = text(formData.get("model_year"));
    const mileageRaw = text(formData.get("mileage"));

    if (!quote.vehicle_id) return fail(quoteId, "Veículo não localizado.");
    if (plate.length !== 7) return fail(quoteId, "Informe a placa com 7 caracteres.");
    if (model.length < 2) return fail(quoteId, "Informe o modelo do veículo.");
    if (brand && brand.length > 80) return fail(quoteId, "Marca inválida.");
    if (model.length > 80) return fail(quoteId, "Modelo inválido.");
    if (version && version.length > 120) return fail(quoteId, "Versão inválida.");

    let modelYear: number | null = null;
    if (yearRaw) {
      const parsedYear = Number(yearRaw.replace(/\D/g, ""));
      if (!Number.isFinite(parsedYear) || parsedYear < 1950 || parsedYear > 2100) {
        return fail(quoteId, "Ano do veículo inválido.");
      }
      modelYear = Math.trunc(parsedYear);
    }

    const mileage = parseMileage(mileageRaw);
    if (mileage === null) return fail(quoteId, "Informe a quilometragem do veículo.");

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .update({
        plate,
        brand,
        model,
        version,
        model_year: modelYear,
        mileage,
      })
      .eq("id", quote.vehicle_id)
      .eq("organization_id", organization.id)
      .select("id")
      .maybeSingle();
    if (vehicleError) return fail(quoteId, `Não foi possível atualizar o veículo: ${vehicleError.message}`);
    if (!vehicle) return fail(quoteId, "Veículo não encontrado.");

    const { data: updatedQuote, error: mileageError } = await supabase
      .from("quotes")
      .update({ mileage })
      .eq("id", quoteId)
      .eq("organization_id", organization.id)
      .select("id")
      .maybeSingle();
    if (mileageError) return fail(quoteId, `Veículo atualizado, mas a km do orçamento falhou: ${mileageError.message}`);
    if (!updatedQuote) return fail(quoteId, "Orçamento não encontrado ao salvar a km.");

    refreshQuotePaths(quoteId);
    revalidatePath("/dashboard/veiculos");
    redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Veículo e km atualizados.")}`);
  }

  return fail(quoteId, "Seção de identidade inválida.");
}


export async function addQuoteItemAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const category = text(formData.get("category")).toLocaleUpperCase("pt-BR");
  const description = text(formData.get("description")).toLocaleUpperCase("pt-BR");
  const quantityRaw = text(formData.get("quantity"));
  const unit = text(formData.get("unit")).toLocaleUpperCase("pt-BR") || "UN";
  const side = optionalUpper(formData.get("side"));
  const specification = optionalUpper(formData.get("specification"));
  const chosenRaw = text(formData.get("chosen_amount"));

  if (!quoteId) redirect("/dashboard/orcamentos");
  const lockError = await assertQuoteNotCommerciallyLocked(supabase, organization.id, quoteId);
  if (lockError) return fail(quoteId, lockError);
  if (description.length < 2) return fail(quoteId, "Informe a descrição da peça.");
  if (description.length > 300) return fail(quoteId, "A descrição da peça é muito longa.");
  if (category.length > 80) return fail(quoteId, "A categoria da peça é muito longa.");
  if (unit.length > 40) return fail(quoteId, "Unidade inválida.");

  const normalizedQuantity = quantityRaw.includes(",")
    ? quantityRaw.replace(/\./g, "").replace(",", ".")
    : quantityRaw;
  const quantity = normalizedQuantity ? Number(normalizedQuantity) : 1;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
    return fail(quoteId, "Quantidade da peça inválida.");
  }

  let chosenAmount: number | null = null;
  if (chosenRaw) {
    const normalizedChosen = chosenRaw.includes(",")
      ? chosenRaw.replace(/\./g, "").replace(",", ".")
      : chosenRaw;
    chosenAmount = Number(normalizedChosen);
    if (!Number.isFinite(chosenAmount) || chosenAmount < 0 || chosenAmount > 1_000_000) {
      return fail(quoteId, "Custo da peça inválido.");
    }
    chosenAmount = Math.round(chosenAmount * 100) / 100;
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (quoteError) return fail(quoteId, `Não foi possível validar o orçamento: ${quoteError.message}`);
  if (!quote) return fail(quoteId, "Orçamento não encontrado.");

  const { error } = await supabase.from("quote_items").insert({
    organization_id: organization.id,
    quote_id: quoteId,
    category: category || "OUTROS",
    description,
    quantity,
    unit,
    side,
    specification,
    purchase_status: chosenAmount !== null ? "approved" : "pending",
    chosen_amount: chosenAmount,
  });
  if (error) return fail(quoteId, `Não foi possível adicionar a peça: ${error.message}`);

  const totalError = await refreshQuoteTotal(supabase, organization.id, quoteId);
  if (totalError) return fail(quoteId, `Peça adicionada, mas não foi possível atualizar o total: ${totalError}`);
  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Peça adicionada e valor atualizado.")}`);
}

export async function duplicateQuoteAction(formData: FormData): Promise<never> {
  const { supabase, organization } = await getCurrentContext();
  const quoteId = text(formData.get("quote_id"));
  const returnTo = text(formData.get("return_to"));

  const failList = (message: string): never => {
    redirect(`/dashboard/orcamentos?error=${encodeURIComponent(message)}`);
  };
  const failSource = (message: string): never => {
    if (returnTo === "list") return failList(message);
    if (!quoteId) return failList(message);
    return fail(quoteId, message);
  };

  if (!quoteId) return failList("Orçamento inválido para duplicar.");

  const { data: source, error: sourceError } = await supabase
    .from("quotes")
    .select("id, customer_id, vehicle_id, priority, mileage, notes")
    .eq("id", quoteId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (sourceError) return failSource(`Não foi possível carregar o orçamento: ${sourceError.message}`);
  if (!source) return failSource("Orçamento não encontrado.");

  const [servicesResult, itemsResult] = await Promise.all([
    supabase
      .from("quote_services")
      .select("category, description, needs_part, quantity, labor_amount")
      .eq("organization_id", organization.id)
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: true }),
    supabase
      .from("quote_items")
      .select("category, description, quantity, unit, side, specification, notes")
      .eq("organization_id", organization.id)
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: true }),
  ]);
  if (servicesResult.error) return failSource(`Não foi possível carregar os serviços: ${servicesResult.error.message}`);
  if (itemsResult.error) return failSource(`Não foi possível carregar as peças: ${itemsResult.error.message}`);

  const services = servicesResult.data ?? [];
  const items = itemsResult.data ?? [];
  if (services.length === 0) {
    return failSource("Não é possível duplicar: o orçamento original não tem serviços.");
  }

  const priority = ["normal", "customer_waiting", "vehicle_stopped"].includes(source.priority)
    ? source.priority
    : "normal";

  const servicesPayload = services.map((service) => ({
    labor_service_id: null,
    service_catalog_id: null,
    category: service.category || "GERAL",
    description: service.description,
    labor_amount: Number(service.labor_amount ?? 0),
    quantity: Number(service.quantity ?? 1),
    needs_part: Boolean(service.needs_part),
  }));

  // Reset purchase/commercial: no chosen/sale amounts → pending purchase; RPC creates draft commercial.
  const itemsPayload = items.map((item) => ({
    category: item.category || "OUTROS",
    description: item.description,
    quantity: Number(item.quantity ?? 1),
    unit: item.unit || "UN",
    side: item.side,
    specification: item.specification,
    notes: item.notes,
    chosen_amount: null,
    sale_unit_amount: null,
  }));

  const { data, error } = await supabase.rpc("create_quote_with_quantities", {
    target_org_id: organization.id,
    target_customer_id: source.customer_id,
    target_vehicle_id: source.vehicle_id,
    target_priority: priority,
    target_mileage: source.mileage,
    target_notes: source.notes ?? "",
    services: servicesPayload,
    items: itemsPayload,
  });
  if (error) return failSource(`Não foi possível duplicar o orçamento: ${error.message}`);
  const created = data?.[0];
  if (!created?.quote_id) return failSource("Duplicação falhou: resultado inválido.");

  refreshQuotePaths(created.quote_id);
  revalidatePath("/dashboard/comercial");
  redirect(
    `/dashboard/orcamentos/${created.quote_id}?ok=${encodeURIComponent(
      `Orçamento duplicado como rascunho (${created.protocol ?? "novo"}).`,
    )}`,
  );
}
