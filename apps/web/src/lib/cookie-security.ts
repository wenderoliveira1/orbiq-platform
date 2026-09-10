/**
 * Cookie flags that stay compatible with local HTTP AutoQA and HTTPS production.
 * Secure follows the public app URL scheme — not the build mode — so CI can run
 * production builds on http://127.0.0.1 without dropping session cookies.
 */
export function shouldUseSecureCookies(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  return appUrl.startsWith("https://");
}

/** Baseline flags merged onto Supabase auth session cookies. */
export function authSessionCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
  };
}
