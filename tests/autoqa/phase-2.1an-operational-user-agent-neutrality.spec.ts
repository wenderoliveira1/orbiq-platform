import { expect, test } from "@playwright/test";

const operationalEndpoints = ["/api/health", "/api/ready", "/api/release"];
const userAgents = ["curl/8.10.1", "kube-probe/1.31", "Orbiq-Monitor/1.0"];

test.describe("Fase 2.1AN - neutralidade do agente operacional", () => {
  for (const endpoint of operationalEndpoints) {
    test(`${endpoint} não varia por User-Agent`, async ({ request }) => {
      const baselineResponse = await request.get(endpoint);
      const baselineBody = await baselineResponse.json();

      for (const userAgent of userAgents) {
        const response = await request.get(endpoint, {
          headers: { "User-Agent": userAgent },
        });
        const cacheControl = response.headers()["cache-control"] ?? "";

        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain("application/json");
        expect(await response.json()).toEqual(baselineBody);
        expect(cacheControl).toContain("no-store");
        expect(response.headers()["set-cookie"]).toBeUndefined();
      }
    });
  }
});
