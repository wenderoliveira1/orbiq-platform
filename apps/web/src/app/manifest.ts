import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f5f7fa",
    categories: ["business", "productivity", "automotive"],
    description:
      "Operações automotivas, orçamentos e gestão de oficinas em uma plataforma segura.",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "any",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        purpose: "any",
        sizes: "192x192",
        src: "/icons/orbiq-192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/icons/orbiq-512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/orbiq-maskable-512.png",
        type: "image/png",
      },
    ],
    id: "/dashboard",
    lang: "pt-BR",
    launch_handler: {
      client_mode: "focus-existing",
    },
    name: "Orbiq — Operações Automotivas",
    orientation: "any",
    scope: "/",
    short_name: "Orbiq",
    shortcuts: [
      {
        description: "Iniciar um novo atendimento na oficina.",
        icons: [
          {
            sizes: "192x192",
            src: "/icons/orbiq-192.png",
            type: "image/png",
          },
        ],
        name: "Novo orçamento",
        short_name: "Novo",
        url: "/dashboard/orcamentos/novo",
      },
      {
        description: "Abrir a lista de orçamentos da oficina.",
        icons: [
          {
            sizes: "192x192",
            src: "/icons/orbiq-192.png",
            type: "image/png",
          },
        ],
        name: "Orçamentos",
        short_name: "Orçamentos",
        url: "/dashboard/orcamentos",
      },
    ],
    start_url: "/dashboard",
    theme_color: "#090d18",
  };
}
