import { shouldUseSecureCookies } from "@/lib/cookie-security";

export const ACTIVE_ORGANIZATION_COOKIE =
  "orbiq_active_organization";

export function activeOrganizationCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
