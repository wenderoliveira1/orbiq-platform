import { requireCurrentPermission } from "../../../_lib/permissions";

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

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

export async function GET(_request: Request, context: RouteContext) {
  const { requestId } = await context.params;

  if (!UUID_PATTERN.test(requestId)) {
    return dataPage("A autorização de exportação é inválida.");
  }

  const { supabase } = await requireCurrentPermission("data.export");
  const { data, error } = await supabase.rpc(
    "consume_organization_data_export",
    {
      target_request_id: requestId,
    },
  );

  if (error) {
    const message =
      error.code === "55000"
        ? "Esta autorização expirou ou já foi utilizada. Gere uma nova exportação."
        : "A exportação não está disponível para esta conta.";

    return dataPage(message);
  }

  const exported = data?.[0];

  if (!exported?.export_snapshot) {
    return dataPage("O snapshot de dados não pôde ser gerado.");
  }

  const manifest = {
    algorithm: "SHA-256",
    byte_size: Number(exported.export_byte_size),
    checksum_scope: "snapshot UTF-8 compacto",
    organization_id: exported.export_organization_id,
    organization_name: exported.export_organization_name,
    schema_version: exported.export_schema_version,
    sha256: exported.export_checksum,
  };
  const body =
    `{"integrity":${JSON.stringify(manifest)},` +
    `"snapshot":${exported.export_snapshot}}\n`;
  const filename = String(exported.export_filename).replace(
    /[^a-zA-Z0-9._-]/g,
    "-",
  );

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Orbiq-Snapshot-SHA256": String(exported.export_checksum),
    },
  });
}
