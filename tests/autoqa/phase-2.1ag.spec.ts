import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AG - contrato HTTP da identidade de release", () => {
  test("expõe somente metadados públicos, sem cache, sessão ou conteúdo extra", async ({ request }) => {
    const response = await request.get("/api/release");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["cache-control"]).toContain("max-age=0");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["set-cookie"]).toBeUndefined();

    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ["channel", "commit", "release", "service", "version"].sort(),
    );
    expect(body.service).toBe("orbiq-web");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
    expect(body.release).toMatch(/^[A-Za-z0-9._-]{1,64}$/);
    expect(body.channel).toMatch(/^(local|ci|preview|production)$/);
    expect(body.commit).toMatch(/^(local|[0-9a-f]{12})$/);

    const serialized = JSON.stringify(body).toLowerCase();
    for (const forbidden of [
      "password",
      "secret",
      "service_role",
      "access_token",
      "private_key",
      "database_url",
      "supabase_url",
      "publishable_key",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
