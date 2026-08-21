import type {
  ReactNode,
} from "react";

import {
  requireCurrentPermission,
} from "../_lib/permissions";


export default async function PermissionLayout({
  children,
}: {
  children:
    ReactNode;
}) {

  await requireCurrentPermission(
    "indicators.view",
  );


  return children;
}