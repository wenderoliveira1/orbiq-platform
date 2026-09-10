import type { ReactNode } from "react";

import { cookies } from "next/headers";

import Link from "next/link";

import {
  getCurrentContext,
} from "./_lib/current-organization";
import {
  permissionsForRole,
} from "./_lib/permissions";
import {
  signOutAction,
  switchOrganizationAction,
} from "./actions";
import { MobileNavigation } from "./mobile-navigation";
import { DashboardNav } from "./nav";
import { OrganizationSwitcher } from "./organization-switcher";
import { ThemeToggle } from "./theme-toggle";
import { parseThemePreference, THEME_COOKIE } from "@/lib/theme";

import "./dashboard.css";
import "./mobile-navigation-shell.css";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const {
    organization,
    membership,
    user,
    availableOrganizations,
  } = await getCurrentContext();

  const cookieStore = await cookies();
  const themePreference = parseThemePreference(
    cookieStore.get(THEME_COOKIE)?.value,
  );

  const permissions = permissionsForRole(membership.role);
  const organizationOptions = availableOrganizations.map((item) => ({
    id: item.id,
    name: item.name,
    role: item.role,
  }));

  return (
    <div className="orbiq-shell">
      <aside className="orbiq-sidebar">
        <div className="orbiq-brand">
          <Link
            href="/dashboard"
            className="orbiq-brand-mark"
            aria-label="Orbiq"
          >
            O
          </Link>

          <div>
            <strong>Orbiq</strong>
            <span>Automotive Operations Platform</span>
          </div>
        </div>

        <div className="orbiq-workshop">
          <OrganizationSwitcher
            organizations={organizationOptions}
            currentOrganizationId={organization.id}
            action={switchOrganizationAction}
          />
        </div>

        <DashboardNav permissions={permissions} />

        <div className="orbiq-sidebar-footer">
          <div className="orbiq-user">
            <span className="orbiq-avatar">
              {(user.email?.[0] ?? "U").toUpperCase()}
            </span>

            <div>
              <strong>{user.email ?? "Usuário Orbiq"}</strong>
              <span>Sessão protegida</span>
            </div>
          </div>

          <ThemeToggle className="orbiq-theme-toggle full-width" initialTheme={themePreference} />

          <Link
            href="/instalar"
            className="orbiq-ghost-button full-width"
          >
            Instalar aplicativo
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              className="orbiq-ghost-button full-width"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      <main className="orbiq-main">
        <MobileNavigation
          organizations={organizationOptions}
          currentOrganizationId={organization.id}
          currentOrganizationName={organization.name}
          permissions={permissions}
          userEmail={user.email ?? "Usuário Orbiq"}
          initialTheme={themePreference}
        />

        <div className="orbiq-content">{children}</div>
      </main>
    </div>
  );
}
