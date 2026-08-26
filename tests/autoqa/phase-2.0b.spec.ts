import { expect, test } from "@playwright/test";

test.describe("Fase 2.0B - portabilidade local e Web", () => {
  test("expõe health check seguro no artefato standalone", async ({
    request,
  }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(await response.json()).toEqual({
      service: "orbiq-web",
      status: "healthy",
    });
  });
});
