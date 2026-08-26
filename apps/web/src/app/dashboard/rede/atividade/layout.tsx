import type { ReactNode } from "react";

import { requireCurrentPermission } from "../../_lib/permissions";

export default async function NetworkGovernancePermissionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentPermission("network.view");

  return children;
}
