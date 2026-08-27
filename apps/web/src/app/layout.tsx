import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { getPublicEnvironment } from "@/lib/public-environment";

import { PwaRegistration } from "./pwa-registration";

import "./globals.css";

const publicEnvironment = getPublicEnvironment();

export const metadata: Metadata = {
  applicationName: "Orbiq",
  description:
    "Plataforma profissional de operações automotivas, orçamentos e gestão de oficinas.",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(publicEnvironment.appUrl),
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
