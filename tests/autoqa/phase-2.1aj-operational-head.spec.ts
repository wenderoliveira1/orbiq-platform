import { expect, test } from "@playwright/test";

const operationalEndpoints = ["/api/health", "/api/ready", "/api/release"];

test.describe("Fase 2.1AJ - sondas HEAD operacionais", () => {
  for (const endpoint of operationalEndpoints) {
    test(`HEAD ${endpoint} é leve e sem sessão`, async ({ request }) => {
      const response = await request.fetch(endpoint, { method: "HEAD" });
      const cacheControl = response.headers()["cache-control"] ?? "";

      expect(response.status()).toBe(200);
      expect((await response.body()).byteLength).toBe(0);
      expect(cacheControl).toContain("no-store");
      expect(cacheControl).toContain("max-age=0");
      expect(response.headers()["set-cookie"]).toBeUndefined();
    });
  }
});
