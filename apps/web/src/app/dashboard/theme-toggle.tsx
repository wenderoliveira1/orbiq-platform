"use client";

import { useSyncExternalStore } from "react";

import {
  THEME_COLORS,
  THEME_COOKIE,
  themeCookieClientMaxAge,
  type ThemePreference,
} from "@/lib/theme";

const themeListeners = new Set<() => void>();

function emitThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function readDocumentTheme(): ThemePreference | null {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : null;
}

function systemTheme(): ThemePreference {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function syncThemeColor(theme: ThemePreference) {
  const color = THEME_COLORS[theme];
  const metas = document.querySelectorAll('meta[name="theme-color"]');

  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", color);
    document.head.appendChild(meta);
    return;
  }

  metas.forEach((meta) => {
    meta.setAttribute("content", color);
  });
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;

  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; secure"
      : "";
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${themeCookieClientMaxAge()}; samesite=lax${secure}`;

  syncThemeColor(theme);
  emitThemeChange();
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", listener);
  return () => {
    themeListeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

function getThemeSnapshot(): ThemePreference {
  return readDocumentTheme() ?? systemTheme();
}

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
  initialTheme?: ThemePreference;
};

export function ThemeToggle({
  className = "orbiq-theme-toggle",
  compact = false,
  initialTheme,
}: ThemeToggleProps) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => initialTheme ?? "light",
  );

  function toggle() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  const label =
    theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
  const visibleLabel = theme === "dark" ? "Claro" : "Escuro";
  const icon = theme === "dark" ? "☀" : "☾";

  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={theme === "dark"}
    >
      <span aria-hidden="true">{icon}</span>
      {compact ? null : <span>{visibleLabel}</span>}
    </button>
  );
}
