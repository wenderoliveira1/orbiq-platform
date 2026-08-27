import { redirect } from "next/navigation";

import { requireCurrentPermission } from "../../../_lib/permissions";

import { ExportDelivery } from "./export-delivery";

const EXPORT_BUCKET = "organization-data-exports";
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

function dataPage(error: string): never {
  redirect(`/dashboard/dados?erro=${encodeURIComponent(error)}`);
}

function recoveryIsActive(consumedAt: string) {
  const timestamp = new Date(consumedAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < RECOVERY_WINDOW_MS;
}

export default async function DataExportDeliveryPage({ params }: PageProps) {
  const { requestId } = await params;

  if (!UUID_PATTERN.test(requestId)) {
    dataPage("A autorização de exportação é inválida.");
  }

  const { supabase, user } = await requireCurrentPermission("data.export");
  const { data: exportRequest, error: exportError } = await supabase
    .from("organization_data_exports")
    .select("id, organization_id, expires_at, downloaded_at")
    .eq("id", requestId)
    .maybeSingle();

  if (exportError || !exportRequest) {
    dataPage("A exportação não está disponível para esta conta.");
  }

  if (exportRequest.downloaded_at) {
    if (!recoveryIsActive(exportRequest.downloaded_at)) {
      dataPage(
        "Esta autorização expirou ou já foi utilizada. Gere uma nova exportação.",
      );
    }

    const { data: files, error: filesError } = await supabase.storage
      .from(EXPORT_BUCKET)
      .list(`${user.id}/${requestId}`, {
        limit: 10,
        sortBy: {
          column: "created_at",
          order: "desc",
        },
      });
    const recoverableArtifact = files?.some((file) =>
      file.name.endsWith(".json"),
    );

    if (filesError || !recoverableArtifact) {
      dataPage(
        "Esta autorização expirou ou já foi utilizada. Gere uma nova exportação.",
      );
    }
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", exportRequest.organization_id)
    .maybeSingle();

  return (
    <ExportDelivery
      requestId={exportRequest.id}
      organizationName={organization?.name ?? "Sua oficina"}
      requestExpiresAt={exportRequest.expires_at}
      consumedAt={exportRequest.downloaded_at}
    />
  );
}
