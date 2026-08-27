import { spawnSync } from "node:child_process";

import { expect, test } from "@playwright/test";

function runPreflight(overrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, ["scripts/release-preflight.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...overrides,
    },
  });
}

test.describe("Fase 2.0J - preflight de publicação", () => {
  test("aprova o artefato local sem expor segredos ou dados de negócio", () => {
    const result = runPreflight();
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toContain("ORBIQ RELEASE PREFLIGHT — FASE 2.0J");
    expect(output).toContain("[OK] Health check");
    expect(output).toContain("[OK] Readiness");
    expect(output).toContain("[OK] Manifesto PWA");
    expect(output).toContain("[OK] Service worker");
    expect(output).toContain("[OK] Shell público e headers");
    expect(output).toContain("[APROVADO]");
    expect(output).not.toMatch(/sb_secret_|service_role/i);
    expect(output).not.toMatch(/Authorization:|Bearer\s+/i);
  });

  test("bloqueia publicação externa sem HTTPS antes de fazer requests", () => {
    const result = runPreflight({
      NEXT_PUBLIC_APP_URL: "http://orbiq.example.com",
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("Ambiente externo precisa usar HTTPS");
    expect(output).not.toContain(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "valor-impossivel",
    );
  });
});
