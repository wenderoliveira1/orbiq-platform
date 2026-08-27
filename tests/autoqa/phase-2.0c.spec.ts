import { Buffer } from "node:buffer";

import { expect, test } from "@playwright/test";

import { parsePublicEnvironment } from "../../packages/config/src/index.mjs";

const baseEnvironment = {
  NEXT_PUBLIC_APP_URL: "https://app.orbiq.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://orbiq.supabase.co",
};

function legacyKey(role: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role }))
    .toString("base64url");

  return `${header}.${payload}.autoqa-signature`;
}

test.describe("Fase 2.0C - ambiente e prontidão", () => {
  test("aceita somente configuração pública compatível", () => {
    const environment = parsePublicEnvironment({
      ...baseEnvironment,
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000/",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyKey("anon"),
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321/",
    });

    expect(environment).toEqual({
      appUrl: "http://127.0.0.1:3000",
      supabasePublishableKey: legacyKey("anon"),
      supabaseUrl: "http://127.0.0.1:54321",
    });
    expect(Object.isFrozen(environment)).toBe(true);
  });

  test("bloqueia chaves privilegiadas antes da inicialização", () => {
    expect(() =>
      parsePublicEnvironment({
        ...baseEnvironment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          "sb_secret_autoqa_never_publish_this_value",
      }),
    ).toThrow(/chave privilegiada/i);

    expect(() =>
      parsePublicEnvironment({
        ...baseEnvironment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyKey("service_role"),
      }),
    ).toThrow(/chave privilegiada/i);
  });

  test("expõe readiness mínimo e sem cache", async ({ request }) => {
    const response = await request.get("/api/ready");
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(JSON.parse(body)).toEqual({
      service: "orbiq-web",
      status: "ready",
    });
    expect(body).not.toContain("supabase");
    expect(body).not.toContain("sb_");
  });
});
