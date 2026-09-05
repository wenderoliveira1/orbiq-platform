"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentContext } from "../../_lib/current-organization";
import { QUOTE_STATUSES } from "../quote-meta";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function fail(quoteId: string, message: string): never {
  redirect(
    `/dashboard/orcamentos/${quoteId}?error=${encodeURIComponent(message)}`,
  );
}

async function refreshQuoteTotal(
  supabase: Awaited<ReturnType<typeof getCurrentContext>>["supabase"],
  organizationId: string,
  quoteId: string,
): Promise<string | null> {
  const [servicesResult, itemsResult] = await Promise.all([
    supabase
      .from("quote_services")
      .select("labor_amount")
      .eq("organization_id", organizationId)
      .eq("quote_id", quoteId),
    supabase
      .from("quote_items")
      .select("chosen_amount")
      .eq("organization_id", organizationId)
      .eq("quote_id", quoteId),
  ]);

  if (servicesResult.error) return servicesResult.error.message;
  if (itemsResult.error) return itemsResult.error.message;

  const laborTotal = (servicesResult.data ?? []).reduce(
    (total, service) => total + (service.labor_amount ?? 0),
    0,
  );
  const partsTotal = (itemsResult.data ?? []).reduce(
    (total, item) => total + (item.chosen_amount ?? 0),
    0,
  );

  const { error } = await supabase
    .from("quotes")
    .update({ final_amount: laborTotal + partsTotal })
    .eq("id", quoteId)
    .eq("organization_id", organizationId);

  return error?.message ?? null;
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

  const validStatus = QUOTE_STATUSES.some((item) => item.value === status);
  if (!validStatus) return fail(quoteId, "Status inválido.");

  const { data, error } = await supabase
    .from("quotes")
    .update({ status })
    .eq("id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();

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
  if (!serviceId) return fail(quoteId, "Serviço inválido.");

  const { data, error } = await supabase
    .from("quote_services")
    .delete()
    .eq("id", serviceId)
    .eq("quote_id", quoteId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();

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
  const category = text(formData.get("category"));
  const description = text(formData.get("description"));
  const laborRaw = text(formData.get("labor_amount"));
  const needsPart = formData.get("needs_part") === "on";

  if (!quoteId) redirect("/dashboard/orcamentos");
  if (!description) return fail(quoteId, "Informe a descrição do serviço.");
  if (description.length > 500) return fail(quoteId, "A descrição do serviço é muito longa.");
  if (category.length > 120) return fail(quoteId, "A categoria do serviço é muito longa.");

  const normalizedLabor = laborRaw.replace(/\./g, "").replace(",", ".");
  const laborAmount = normalizedLabor ? Number(normalizedLabor) : 0;
  if (!Number.isFinite(laborAmount) || laborAmount < 0 || laborAmount > 1_000_000) {
    return fail(quoteId, "Valor de mão de obra inválido.");
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (quoteError) return fail(quoteId, `Não foi possível validar o orçamento: ${quoteError.message}`);
  if (!quote) return fail(quoteId, "Orçamento não encontrado.");

  const { error } = await supabase.from("quote_services").insert({
    organization_id: organization.id,
    quote_id: quoteId,
    category: category || "Geral",
    description,
    needs_part: needsPart,
    labor_amount: laborAmount,
  });

  if (error) return fail(quoteId, `Não foi possível adicionar o serviço: ${error.message}`);

  const totalError = await refreshQuoteTotal(supabase, organization.id, quoteId);
  if (totalError) return fail(quoteId, `Serviço adicionado, mas não foi possível atualizar o total: ${totalError}`);

  refreshQuotePaths(quoteId);
  redirect(`/dashboard/orcamentos/${quoteId}?ok=${encodeURIComponent("Serviço adicionado e valor atualizado.")}`);
}
