import type { ReactNode } from "react";

import { requireCurrentPermission } from "../_lib/permissions";

export default async function DataPermissionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentPermission("data.export");

  return children;
}
