import {
  redirect,
} from "next/navigation";

import {
  getCurrentContext,
} from "./current-organization";


export type OrbiqRole =
  | "owner"
  | "admin"
  | "manager"
  | "estimator"
  | "technician"
  | "viewer";


export const ALL_PERMISSIONS = [
  "dashboard.view",
  "indicators.view",
  "audit.view",
  "team.view",
  "team.manage",
  "customers.manage",
  "vehicles.manage",
  "quotes.view",
  "quotes.manage",
  "supplier_quotes.manage",
  "commercial.manage",
  "purchases.manage",
  "execution.manage",
  "labor.manage",
  "suppliers.manage",
  "settings.manage",
] as const;


export type OrbiqPermission =
  (
    typeof ALL_PERMISSIONS
  )[number];


const ROLE_PERMISSIONS:
  Record<
    OrbiqRole,
    readonly OrbiqPermission[]
  > = {

  owner:
    ALL_PERMISSIONS,

  admin:
    ALL_PERMISSIONS,

  manager: [
    "dashboard.view",
    "indicators.view",
    "audit.view",
    "team.view",
    "customers.manage",
    "vehicles.manage",
    "quotes.view",
    "quotes.manage",
    "supplier_quotes.manage",
    "commercial.manage",
    "purchases.manage",
    "execution.manage",
    "labor.manage",
    "suppliers.manage",
  ],

  estimator: [
    "dashboard.view",
    "customers.manage",
    "vehicles.manage",
    "quotes.view",
    "quotes.manage",
    "supplier_quotes.manage",
    "labor.manage",
    "suppliers.manage",
  ],

  technician: [
    "dashboard.view",
    "quotes.view",
    "execution.manage",
  ],

  viewer: [
    "dashboard.view",
    "quotes.view",
  ],
};


export function normalizeRole(
  role:
    string |
    null |
    undefined,
): OrbiqRole | null {

  const value =
    String(
      role ??
      "",
    )
      .trim()
      .toLowerCase();


  if (
    value === "owner" ||
    value === "admin" ||
    value === "manager" ||
    value === "estimator" ||
    value === "technician" ||
    value === "viewer"
  ) {

    return value;
  }


  return null;
}


export function permissionsForRole(
  role:
    string |
    null |
    undefined,
): OrbiqPermission[] {

  const normalized =
    normalizeRole(
      role,
    );


  if (!normalized) {

    return [];
  }


  return [
    ...ROLE_PERMISSIONS[
      normalized
    ],
  ];
}


export function hasPermissionForRole(
  role:
    string |
    null |
    undefined,

  permission:
    string,
): boolean {

  const permissions =
    permissionsForRole(
      role,
    );


  return permissions.includes(
    permission as OrbiqPermission,
  );
}


export async function requireCurrentPermission(
  permission:
    string,
) {

  const context =
    await getCurrentContext();


  const allowed =
    hasPermissionForRole(
      context.membership.role,
      permission,
    );


  if (!allowed) {

    redirect(
      `/dashboard/sem-acesso?permission=${encodeURIComponent(
        permission,
      )}`,
    );
  }


  return context;
}