/** Cookie-authenticated route handlers do not inherit Server Action CSRF checks. */
export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;

  try {
    // Use the configured public origin behind a reverse proxy. Never trust
    // arbitrary forwarded-host headers supplied by a caller.
    const expected = new URL(
      process.env.NEXT_PUBLIC_APP_URL?.trim() || request.url,
    ).origin;
    return new URL(origin).origin === expected && origin === expected;
  } catch {
    return false;
  }
}

export function forbiddenMutation(): Response {
  return new Response("Origem da solicitação inválida.", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}
