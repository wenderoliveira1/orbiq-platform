import type { ReactNode } from "react";
import Link from "next/link";

import { DashboardNav } from "./nav";
import { signOutAction } from "./actions";
import { getCurrentContext } from "./_lib/current-organization";

import "./dashboard.css";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const {
    organization,
    membership,
    user,
  } = await getCurrentContext();

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

            <span>
              Automotive Operations Platform
            </span>
          </div>
        </div>

        <div className="orbiq-workshop">
          <span className="orbiq-eyebrow">
            OFICINA ATIVA
          </span>

          <strong>{organization.name}</strong>

          <span className="orbiq-role">
            {membership.role}
          </span>
        </div>

        <DashboardNav />

        <div className="orbiq-sidebar-footer">
          <div className="orbiq-user">
            <span className="orbiq-avatar">
              {(user.email?.[0] ?? "U").toUpperCase()}
            </span>

            <div>
              <strong>
                {user.email ?? "Usuário Orbiq"}
              </strong>

              <span>Sessão protegida</span>
            </div>
          </div>

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
        <header className="orbiq-mobile-header">
          <Link
            href="/dashboard"
            className="orbiq-brand-mark"
            aria-label="Orbiq"
          >
            O
          </Link>

          <div>
            <strong>Orbiq</strong>

            <span>{organization.name}</span>
          </div>
        </header>

        <div className="orbiq-content">
          {children}
        </div>
      </main>
    </div>
  );
}