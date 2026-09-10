/**
 * Cookie flags that stay compatible with local HTTP AutoQA and HTTPS production.
 * Never key Secure off NODE_ENV alone — CI runs production builds on http://127.0.0.1.
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
