import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const operationalPaths = ["/api/health", "/api/ready", "/api/release"];

test.describe("Fase 2.0M - isolamento dos endpoints operacionais", () => {
  test("mantém health, ready e release fora do proxy de sessão", async () => {
    const source = await readFile("apps/web/src/proxy.ts", "utf8");

    expect(source).toContain("api/health");
    expect(source).toContain("api/ready");
    expect(source).toContain("api/release");
    expect(source).toContain("manifest.webmanifest");
  });

  test("endpoints operacionais não renovam sessão nem expõem cache", async ({
    request,
  }) => {
    for (const path of operationalPaths) {
      const response = await request.get(path, {
        headers: {
          cookie: "orbiq_probe=invalid-session-probe",
        },
      });

      expect(response.status(), path).toBe(200);
      expect(response.headers()["set-cookie"], path).toBeUndefined();
      expect(response.headers()["cache-control"], path).toContain("no-store");
      expect(response.headers()["x-content-type-options"], path).toBe("nosniff");
    }
  });
});
