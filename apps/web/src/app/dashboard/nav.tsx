"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/dashboard",
    icon: "⌂",
    label: "Visão geral",
  },
  {
    href: "/dashboard/orcamentos/novo",
    icon: "+",
    label: "Novo orçamento",
  },
  {
    href: "/dashboard/orcamentos",
    icon: "▤",
    label: "Orçamentos",
  },
  {
    href: "/dashboard/clientes",
    icon: "◎",
    label: "Clientes",
  },
  {
    href: "/dashboard/veiculos",
    icon: "▣",
    label: "Veículos",
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      className="orbiq-nav"
      aria-label="Navegação principal"
    >
      {items.map((item) => {
        let active = false;

        if (item.href === "/dashboard") {
          active =
            pathname === "/dashboard";
        } else if (
          item.href ===
          "/dashboard/orcamentos"
        ) {
          active =
            pathname === item.href ||
            (
              pathname.startsWith(
                "/dashboard/orcamentos/",
              ) &&
              !pathname.startsWith(
                "/dashboard/orcamentos/novo",
              )
            );
        } else {
          active =
            pathname === item.href ||
            pathname.startsWith(
              item.href + "/",
            );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              `orbiq-nav-item${
                active
                  ? " is-active"
                  : ""
              }`
            }
          >
            <span
              className="orbiq-nav-icon"
              aria-hidden="true"
            >
              {item.icon}
            </span>

            <span>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}