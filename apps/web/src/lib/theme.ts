import { shouldUseSecureCookies } from "@/lib/cookie-security";

export const THEME_COOKIE = "orbiq_theme";

export type ThemePreference = "light" | "dark";

export const THEME_COLORS = {
  light: "#f5f7fa",
  dark: "#090d18",
} as const;

export function parseThemePreference(
  value: string | undefined | null,
): ThemePreference | undefined {
  if (value === "light" || value === "dark") {
    return value;
  }

  return undefined;
}

export function themeCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export function themeCookieClientMaxAge() {
  return 60 * 60 * 24 * 365;
}
