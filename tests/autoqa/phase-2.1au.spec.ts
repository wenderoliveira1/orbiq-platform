import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AU - contrato seguro de observabilidade do PWA", () => {
  test("documenta eventos, limites e dados proibidos sem mecanismo destrutivo", async () => {
    const source = await readFile("docs/phase-2.1au.md", "utf8");

    for (const event of [
      "update_detected",
      "update_deferred",
      "update_requested",
      "update_activated",
      "update_failed",
    ]) {
      expect(source).toContain(event);
    }

    expect(source).toContain("attempt` inteiro entre `0` e `3`");
    expect(source).toContain("ORBIQ_SKIP_WAITING");
    expect(source).toContain("controllerchange");
    expect(source).toContain("Cache Storage");
    expect(source).toContain("sem reload automático");
    expect(source).not.toContain("supabase db reset");
    expect(source).not.toContain("service_role");
  });
});
