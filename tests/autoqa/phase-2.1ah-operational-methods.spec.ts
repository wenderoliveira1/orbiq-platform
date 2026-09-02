import { expect, test } from "@playwright/test";

const operationalEndpoints = ["/api/health", "/api/ready", "/api/release"];
const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];

test.describe("Fase 2.1AH - métodos dos endpoints operacionais", () => {
  for (const endpoint of operationalEndpoints) {
    for (const method of mutatingMethods) {
      test(`${method} ${endpoint} não é aceito`, async ({ request }) => {
        const response = await request.fetch(endpoint, { method });

        expect(response.status()).toBe(405);
        expect(response.headers()["set-cookie"]).toBeUndefined();
      });
    }
  }
});
