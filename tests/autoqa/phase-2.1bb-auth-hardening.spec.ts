import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BB — endurecimento de autenticação e cookies", () => {
  test("mantém headers de segurança no shell público", async ({ request }) => {
    const login = await request.get("/login");
    expect(login.ok()).toBe(true);

    const headers = login.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers["permissions-policy"]).toContain("camera=(self)");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });

  test("redireciona dashboard sem sessão para login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("aplica Secure só em HTTPS e mapeia erros de login em PT-BR", async () => {
    const cookieSecurity = await readFile(
      "apps/web/src/lib/cookie-security.ts",
      "utf8",
    );
    const org = await readFile(
      "apps/web/src/lib/organization-context.ts",
      "utf8",
    );
    const theme = await readFile("apps/web/src/lib/theme.ts", "utf8");
    const proxy = await readFile(
      "apps/web/src/lib/supabase/proxy.ts",
      "utf8",
    );
    const server = await readFile(
      "apps/web/src/lib/supabase/server.ts",
      "utf8",
    );
    const client = await readFile(
      "apps/web/src/lib/supabase/client.ts",
      "utf8",
    );
    const loginActions = await readFile(
      "apps/web/src/app/login/actions.ts",
      "utf8",
    );
    const nextConfig = await readFile("apps/web/next.config.ts", "utf8");

    expect(cookieSecurity).toContain("shouldUseSecureCookies");
    expect(cookieSecurity).toContain('startsWith("https://")');
    expect(cookieSecurity).toContain("NEXT_PUBLIC_APP_URL");
    expect(cookieSecurity).not.toContain("process.env.NODE_ENV");
    expect(org).toContain("shouldUseSecureCookies()");
    expect(theme).toContain("shouldUseSecureCookies()");
    expect(proxy).toContain("authSessionCookieOptions");
    expect(proxy).toContain('pathname = "/login"');
    expect(proxy).toContain('pathname.startsWith("/dashboard/")');
    expect(server).toContain("authSessionCookieOptions");
    expect(client).toContain("authSessionCookieOptions");
    expect(loginActions).toContain("Confirme seu e-mail antes de entrar.");
    expect(loginActions).toContain(
      "Muitas tentativas. Aguarde um momento e tente de novo.",
    );
    expect(loginActions).toContain(
      "Não foi possível conectar. Verifique sua conexão e tente de novo.",
    );
    expect(loginActions).toContain("E-mail ou senha inválidos.");
    expect(nextConfig).toContain("Cross-Origin-Opener-Policy");
    expect(nextConfig).toContain("Permissions-Policy");
  });
});
