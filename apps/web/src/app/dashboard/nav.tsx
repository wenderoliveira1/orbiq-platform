"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/dashboard",
    label: "Visão geral",
    icon: "⌂",
  },
  {
    href: "/dashboard/clientes",
    label: "Clientes",
    icon: "◎",
  },
  {
    href: "/dashboard/veiculos",
    label: "Veículos",
    icon: "▣",
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="orbiq-nav" aria-label="Navegação principal">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`orbiq-nav-item${active ? " is-active" : ""}`}
          >
            <span className="orbiq-nav-icon" aria-hidden="true">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </Link>
        );
      })}

      <div className="orbiq-nav-separator" />

      <div
        className="orbiq-nav-item is-disabled"
        aria-disabled="true"
      >
        <span className="orbiq-nav-icon" aria-hidden="true">
          ＋
        </span>

        <span>Novo orçamento</span>

        <small>Fase 1.1</small>
      </div>
    </nav>
  );
}