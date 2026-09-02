import { expect, test } from "@playwright/test";

const operationalEndpoints = [
  {
    path: "/api/health",
    fields: ["service", "status"],
  },
  {
    path: "/api/ready",
    fields: ["service", "status"],
  },
  {
    path: "/api/release",
    fields: ["channel", "commit", "release", "service", "version"],
  },
];

test.describe("Fase 2.1AI - orçamento dos payloads operacionais", () => {
  for (const endpoint of operationalEndpoints) {
    test(`${endpoint.path} permanece mínimo e previsível`, async ({ request }) => {
      const response = await request.get(endpoint.path);
      const payload = await response.body();

      expect(response.ok()).toBe(true);
      expect(payload.byteLength).toBeLessThanOrEqual(512);

      const body = JSON.parse(payload.toString("utf8")) as Record<string, unknown>;
      expect(Array.isArray(body)).toBe(false);
      expect(Object.keys(body).sort()).toEqual([...endpoint.fields].sort());
    });
  }
});
