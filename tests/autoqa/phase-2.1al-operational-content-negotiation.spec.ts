import { expect, test } from "@playwright/test";

const operationalEndpoints = ["/api/health", "/api/ready", "/api/release"];
const acceptHeaders = ["text/html", "application/xml", "*/*"];

test.describe("Fase 2.1AL - representação JSON operacional", () => {
  for (const endpoint of operationalEndpoints) {
    test(`${endpoint} mantém JSON para qualquer Accept comum`, async ({ request }) => {
      const baselineResponse = await request.get(endpoint);
      const baselineBody = await baselineResponse.json();

      for (const accept of acceptHeaders) {
        const response = await request.get(endpoint, {
          headers: { Accept: accept },
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
