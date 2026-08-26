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
        purpose: "any maskable",
        sizes: "any",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    id: "/dashboard",
    lang: "pt-BR",
    name: "Orbiq — Operações Automotivas",
    orientation: "any",
    scope: "/",
    short_name: "Orbiq",
    start_url: "/dashboard",
    theme_color: "#090d18",
  };
}
