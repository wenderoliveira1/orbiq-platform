import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import { getPublicEnvironment } from "@/lib/public-environment";
import { parseThemePreference, THEME_COOKIE } from "@/lib/theme";

import { ConnectivityStatus } from "./connectivity-status";
import { PwaRegistration } from "./pwa-registration";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-orbiq",
});

const publicEnvironment = getPublicEnvironment();

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Orbiq",
  },
  applicationName: "Orbiq",
  description:
    "Plataforma profissional de operações automotivas, orçamentos e gestão de oficinas.",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(publicEnvironment.appUrl),
  other: {
    // Next 16 emits the standards-based mobile-web-app-capable tag. Keep the
    // Apple-prefixed variant as a compatibility signal for older Safari/iOS.
    "apple-mobile-web-app-capable": "yes",
  },
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const theme = parseThemePreference(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="pt-BR"
      className={inter.variable}
      {...(theme ? { "data-theme": theme } : {})}
      style={theme ? { colorScheme: theme } : undefined}
    >
      <body className={inter.className}>
        <ConnectivityStatus />
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
