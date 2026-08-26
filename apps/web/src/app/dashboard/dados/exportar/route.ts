import { requireCurrentPermission } from "../../_lib/permissions";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function seeOther(location: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
    },
  });
}

function dataPage(error: string) {
  return seeOther(`/dashboard/dados?erro=${encodeURIComponent(error)}`);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const organizationId = String(
    formData.get("organization_id") ?? "",
  ).trim();

  if (!UUID_PATTERN.test(organizationId)) {
    return dataPage("A oficina informada é inválida.");
  }

  const { supabase } = await requireCurrentPermission("data.export");
  const { data, error } = await supabase.rpc(
    "create_organization_data_export",
    {
      target_org_id: organizationId,
    },
  );

  if (error) {
    const message =
      error.code === "54000"
        ? "O limite de três novas exportações por hora foi atingido. Tente novamente mais tarde."
        : "Não foi possível autorizar a exportação desta oficina.";

    return dataPage(message);
  }

  const exportRequest = data?.[0];

  if (!exportRequest?.export_request_id) {
    return dataPage(
      "A autorização da exportação não pôde ser concluída.",
    );
  }

  return seeOther(
    `/dashboard/dados/exportar/${exportRequest.export_request_id}`,
  );
}
