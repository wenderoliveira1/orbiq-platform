"use server";

import { revalidatePath } from "next/cache";

import { getCurrentContext } from "../_lib/current-organization";
import { requireCurrentPermission } from "../_lib/permissions";

type IncidentSource = "dashboard_error" | "global_error" | "server_action";

type ReportIncidentInput = {
  fingerprint: string;
  route: string;
  source: IncidentSource;
};

export async function reportIncidentAction(input: ReportIncidentInput) {
  try {
    const { supabase, organization } = await getCurrentContext();
    const { data, error } = await supabase.rpc("report_application_incident", {
      target_org_id: organization.id,
      target_fingerprint: String(input.fingerprint ?? "").slice(0, 128),
      target_source: input.source,
      target_route: String(input.route ?? "/dashboard").split("?", 1)[0].slice(0, 180),
    });

    if (error) {
      return { ok: false as const };
    }

    const incident = data?.[0];

    return {
      ok: true as const,
      incidentId: incident?.incident_id ?? null,
    };
  } catch {
    return { ok: false as const };
  }
}

export async function resolveIncidentAction(formData: FormData) {
  const incidentId = String(formData.get("incident_id") ?? "").trim();
  const resolutionNote = String(formData.get("resolution_note") ?? "").trim().slice(0, 500);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incidentId)) {
    throw new Error("Incidente inválido.");
  }

  const { supabase } = await requireCurrentPermission("network.view");
  const { error } = await supabase.rpc("resolve_application_incident", {
    target_incident_id: incidentId,
    target_resolution_note: resolutionNote,
  });

  if (error) {
    throw new Error(`Falha ao resolver o incidente: ${error.message}`);
  }

  revalidatePath("/dashboard/confiabilidade");
  revalidatePath("/dashboard/rede/atividade");
}
