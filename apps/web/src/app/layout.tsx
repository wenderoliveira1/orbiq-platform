import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { PwaRegistration } from "./pwa-registration";

import "./globals.css";

function metadataBase() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ??
    process.env.VERCEL_URL?.trim();
  const value = configuredUrl || (vercelUrl ? `https://${vercelUrl}` : "");

  if (!value) {
    return undefined;
  }

  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  applicationName: "Orbiq",
  description:
    "Plataforma profissional de operações automotivas, orçamentos e gestão de oficinas.",
  manifest: "/manifest.webmanifest",
  metadataBase: metadataBase(),
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
  title: {
    default: "Orbiq",
    template: "%s | Orbiq",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  initialScale: 1,
  themeColor: [
    { color: "#f5f7fa", media: "(prefers-color-scheme: light)" },
    { color: "#090d18", media: "(prefers-color-scheme: dark)" },
  ],
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
