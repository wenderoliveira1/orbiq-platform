export const NAVIGATION_GROUPS = [
  "Visão e gestão",
  "Operação",
  "Cadastros",
  "Administração",
] as const;

export type NavigationGroup = (typeof NAVIGATION_GROUPS)[number];

export type NavigationItem = Readonly<{
  group: NavigationGroup;
  href: string;
  icon: string;
  label: string;
  permission: string;
  shortcut?: boolean;
}>;

export const navigationItems: readonly NavigationItem[] = [
  {
    group: "Visão e gestão",
    href: "/dashboard",
    icon: "⌂",
    label: "Visão geral",
    permission: "dashboard.view",
    shortcut: true,
  },
  {
    group: "Visão e gestão",
    href: "/dashboard/indicadores",
    icon: "◒",
    label: "Indicadores",
    permission: "indicators.view",
  },
  {
    group: "Visão e gestão",
    href: "/dashboard/rede",
    icon: "◆",
    label: "Visão da rede",
    permission: "network.view",
  },
  {
    group: "Visão e gestão",
    href: "/dashboard/rede/atividade",
    icon: "◈",
    label: "Governança",
    permission: "network.view",
  },
  {
    group: "Visão e gestão",
    href: "/dashboard/confiabilidade",
    icon: "⊙",
    label: "Confiabilidade",
    permission: "network.view",
  },
  {
    group: "Visão e gestão",
    href: "/dashboard/atividade",
    icon: "◉",
    label: "Atividade",
    permission: "audit.view",
  },
  {
    group: "Visão e gestão",
    href: "/dashboard/equipe",
    icon: "♙",
    label: "Equipe",
    permission: "team.view",
  },
  {
    group: "Operação",
    href: "/dashboard/orcamentos/novo",
    icon: "+",
    label: "Novo orçamento",
    permission: "quotes.manage",
    shortcut: true,
  },
  {
    group: "Operação",
    href: "/dashboard/orcamentos",
    icon: "▤",
    label: "Orçamentos",
    permission: "quotes.view",
    shortcut: true,
  },
  {
    group: "Operação",
    href: "/dashboard/cotacoes",
    icon: "↗",
    label: "Cotações",
    permission: "supplier_quotes.manage",
  },
  {
    group: "Operação",
    href: "/dashboard/comercial",
    icon: "$",
    label: "Comercial",
    permission: "commercial.manage",
  },
  {
    group: "Operação",
    href: "/dashboard/compras",
    icon: "□",
    label: "Compras",
    permission: "purchases.manage",
  },
  {
    group: "Operação",
    href: "/dashboard/execucao",
    icon: "▶",
    label: "Execução",
    permission: "execution.manage",
  },
  {
    group: "Operação",
    href: "/dashboard/mao-de-obra",
    icon: "◫",
    label: "Mão de obra",
    permission: "labor.manage",
  },
  {
    group: "Cadastros",
    href: "/dashboard/fornecedores",
    icon: "◇",
    label: "Fornecedores",
    permission: "suppliers.manage",
  },
  {
    group: "Cadastros",
    href: "/dashboard/clientes",
    icon: "◎",
    label: "Clientes",
    permission: "customers.manage",
  },
  {
    group: "Cadastros",
    href: "/dashboard/veiculos",
    icon: "▣",
    label: "Veículos",
    permission: "vehicles.manage",
  },
  {
    group: "Administração",
    href: "/dashboard/oficinas",
    icon: "▦",
    label: "Oficinas",
    permission: "organizations.manage",
  },
  {
    group: "Administração",
    href: "/dashboard/dados",
    icon: "⇩",
    label: "Dados e privacidade",
    permission: "data.export",
  },
  {
    group: "Administração",
    href: "/dashboard/configuracoes",
    icon: "⚙",
    label: "Configurações",
    permission: "settings.manage",
  },
  {
    group: "Administração",
    href: "/dashboard/suporte",
    icon: "?",
    label: "Suporte técnico",
    permission: "dashboard.view",
  },
];

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/dashboard/rede") {
    return pathname === href;
  }

  if (href === "/dashboard/orcamentos") {
    return (
      pathname === href ||
      (pathname.startsWith("/dashboard/orcamentos/") &&
        !pathname.startsWith("/dashboard/orcamentos/novo"))
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
