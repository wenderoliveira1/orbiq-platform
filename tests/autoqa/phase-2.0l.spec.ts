import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

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

test.describe("Fase 2.0L - preflight de publicação", () => {
  test("aprova o artefato local e valida release/PWA sem expor segredos", () => {
    const result = runPreflight();
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(output).toContain("ORBIQ PUBLICATION PREFLIGHT — FASE 2.0L");
    expect(output).toContain("[OK] Health check");
    expect(output).toContain("[OK] Readiness");
    expect(output).toContain("[OK] Identidade de release");
    expect(output).toContain("[OK] Manifesto PWA");
    expect(output).toContain("[OK] Service worker");
    expect(output).toContain("[OK] Shell público e headers");
    expect(output).toContain("[APROVADO]");
    expect(output).not.toMatch(/sb_secret_|service_role/i);
    expect(output).not.toMatch(/Authorization:|Bearer\s+/i);
  });

  test("bloqueia destino externo sem HTTPS antes da publicação", () => {
    const result = runPreflight({
      NEXT_PUBLIC_APP_URL: "http://orbiq.example.com",
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(1);
    expect(output).toContain("Ambiente externo precisa usar HTTPS");
    expect(output).not.toContain(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "valor-impossivel",
    );
  });

  test("mantém o comando de promoção separado do release drill", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    const source = await readFile("scripts/release-preflight.mjs", "utf8");

    expect(packageJson.scripts?.["release:preflight"]).toBe(
      "node scripts/release-preflight.mjs",
    );
    expect(packageJson.scripts?.["release:drill"]).toBe(
      "node scripts/release-drill.mjs",
    );
    expect(source).toContain('/api/release');
    expect(source).toContain('/manifest.webmanifest');
    expect(source).toContain('/sw.js');
    expect(source).not.toContain("supabase db reset");
  });
});
