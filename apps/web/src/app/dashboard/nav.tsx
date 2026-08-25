"use client";

import {
  useEffect,
  useRef,
} from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";


const items = [
  {
    href:
      "/dashboard",

    icon:
      "⌂",

    label:
      "Visão geral",

    permission:
      "dashboard.view",
  },
  {
    href:
      "/dashboard/indicadores",

    icon:
      "◒",

    label:
      "Indicadores",

    permission:
      "indicators.view",
  },
  {
    href:
      "/dashboard/atividade",

    icon:
      "◉",

    label:
      "Atividade",

    permission:
      "audit.view",
  },
  {
    href:
      "/dashboard/equipe",

    icon:
      "♙",

    label:
      "Equipe",

    permission:
      "team.view",
  },
  {
    href:
      "/dashboard/orcamentos/novo",

    icon:
      "+",

    label:
      "Novo orçamento",

    permission:
      "quotes.manage",
  },
  {
    href:
      "/dashboard/orcamentos",

    icon:
      "▤",

    label:
      "Orçamentos",

    permission:
      "quotes.view",
  },
  {
    href:
      "/dashboard/cotacoes",

    icon:
      "↗",

    label:
      "Cotações",

    permission:
      "supplier_quotes.manage",
  },
  {
    href:
      "/dashboard/comercial",

    icon:
      "$",

    label:
      "Comercial",

    permission:
      "commercial.manage",
  },
  {
    href:
      "/dashboard/compras",

    icon:
      "□",

    label:
      "Compras",

    permission:
      "purchases.manage",
  },
  {
    href:
      "/dashboard/execucao",

    icon:
      "▶",

    label:
      "Execução",

    permission:
      "execution.manage",
  },
  {
    href:
      "/dashboard/mao-de-obra",

    icon:
      "◫",

    label:
      "Mão de obra",

    permission:
      "labor.manage",
  },
  {
    href:
      "/dashboard/fornecedores",

    icon:
      "◇",

    label:
      "Fornecedores",

    permission:
      "suppliers.manage",
  },
  {
    href:
      "/dashboard/clientes",

    icon:
      "◎",

    label:
      "Clientes",

    permission:
      "customers.manage",
  },
  {
    href:
      "/dashboard/veiculos",

    icon:
      "▣",

    label:
      "Veículos",

    permission:
      "vehicles.manage",
  },
  {
    href:
      "/dashboard/oficinas",

    icon:
      "▦",

    label:
      "Oficinas",

    permission:
      "organizations.manage",
  },
  {
    href:
      "/dashboard/configuracoes",

    icon:
      "⚙",

    label:
      "Configurações",

    permission:
      "settings.manage",
  },
];


export function DashboardNav({
  permissions,
}: {
  permissions:
    string[];
}) {

  const pathname =
    usePathname();

  const navigationRef =
    useRef<HTMLElement>(
      null,
    );


  useEffect(
    () => {

      const activeItem =
        navigationRef.current
          ?.querySelector<HTMLElement>(
            '[aria-current="page"]',
          );


      activeItem?.scrollIntoView(
        {
          block:
            "nearest",

          inline:
            "nearest",
        },
      );
    },
    [
      pathname,
    ],
  );


  const allowed =
    new Set(
      permissions,
    );


  return (
    <nav
      ref={
        navigationRef
      }
      className="orbiq-nav"
      aria-label="Navegação principal"
      tabIndex={
        0
      }
    >

      {items
        .filter(
          (item) =>
            allowed.has(
              item.permission,
            ),
        )
        .map(
          (item) => {

            let active =
              false;


            if (
              item.href ===
              "/dashboard"
            ) {

              active =
                pathname ===
                "/dashboard";
            }
            else if (
              item.href ===
              "/dashboard/orcamentos"
            ) {

              active =
                pathname ===
                  item.href ||
                (
                  pathname.startsWith(
                    "/dashboard/orcamentos/",
                  ) &&
                  !pathname.startsWith(
                    "/dashboard/orcamentos/novo",
                  )
                );
            }
            else {

              active =
                pathname ===
                  item.href ||
                pathname.startsWith(
                  item.href +
                    "/",
                );
            }


            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
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
          },
        )}

    </nav>
  );
}