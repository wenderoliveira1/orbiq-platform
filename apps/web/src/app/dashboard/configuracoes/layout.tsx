import type {
  ReactNode,
} from "react";

import {
  requireCurrentPermission,
} from "../_lib/permissions";


export default async function SettingsLayout({
  children,
}: {
  children:
    ReactNode;
}) {

  await requireCurrentPermission(
    "settings.manage",
  );


  return children;
}