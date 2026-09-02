import { expect, test } from "@playwright/test";

const operationalEndpoints = ["/api/health", "/api/ready", "/api/release"];
const languages = ["pt-BR,pt;q=0.9", "en-US,en;q=0.9", "ja-JP,ja;q=0.9"];

test.describe("Fase 2.1AM - neutralidade de idioma operacional", () => {
  for (const endpoint of operationalEndpoints) {
    test(`${endpoint} não varia por Accept-Language`, async ({ request }) => {
      const baselineResponse = await request.get(endpoint);
      const baselineBody = await baselineResponse.json();

      for (const language of languages) {
        const response = await request.get(endpoint, {
          headers: { "Accept-Language": language },
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
