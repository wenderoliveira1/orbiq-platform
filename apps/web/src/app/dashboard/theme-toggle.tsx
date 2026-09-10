"use client";

import { useEffect, useState } from "react";

import {
  THEME_COLORS,
  THEME_COOKIE,
  themeCookieClientMaxAge,
  type ThemePreference,
} from "@/lib/theme";

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
}

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({
  className = "orbiq-theme-toggle",
  compact = false,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = readDocumentTheme() ?? systemTheme();
    setTheme(current);
    setReady(true);

    if (readDocumentTheme()) {
      syncThemeColor(current);
    }
  }, []);

  function toggle() {
    const next: ThemePreference = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
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
      aria-pressed={ready ? theme === "dark" : undefined}
    >
      <span aria-hidden="true">{icon}</span>
      {compact ? null : <span>{visibleLabel}</span>}
    </button>
  );
}
