import type { ReactNode } from "react";

import { requireCurrentPermission } from "../_lib/permissions";

export default async function ReliabilityPermissionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentPermission("network.view");

  return children;
}
