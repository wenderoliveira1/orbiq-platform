import { expect, test } from "@playwright/test";

const operationalEndpoints = ["/api/health", "/api/ready", "/api/release"];
const diagnosticQuery = "debug=true&verbose=true&format=full";

test.describe("Fase 2.1AK - neutralidade de query operacional", () => {
  for (const endpoint of operationalEndpoints) {
    test(`${endpoint} ignora parâmetros de diagnóstico`, async ({ request }) => {
      const [baselineResponse, queriedResponse] = await Promise.all([
        request.get(endpoint),
        request.get(`${endpoint}?${diagnosticQuery}`),
      ]);
      const cacheControl = queriedResponse.headers()["cache-control"] ?? "";

      expect(baselineResponse.status()).toBe(200);
      expect(queriedResponse.status()).toBe(200);
      expect(await queriedResponse.json()).toEqual(await baselineResponse.json());
      expect(cacheControl).toContain("no-store");
      expect(cacheControl).toContain("max-age=0");
      expect(queriedResponse.headers()["set-cookie"]).toBeUndefined();
    });
  }
});
