import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0K - drill de release e rollback readiness", () => {
  test("mantém health, ready e release como contrato verificável do artefato", async ({
    request,
  }) => {
    const [health, ready, release] = await Promise.all([
      request.get("/api/health"),
      request.get("/api/ready"),
      request.get("/api/release"),
    ]);

    expect(health.status()).toBe(200);
    expect(ready.status()).toBe(200);
    expect(release.status()).toBe(200);

    const healthBody = (await health.json()) as {
      service?: string;
      status?: string;
    };
    const readyBody = (await ready.json()) as {
      service?: string;
      status?: string;
    };

    expect(healthBody).toMatchObject({
      service: "orbiq-web",
      status: "healthy",
    });
    expect(readyBody).toMatchObject({
      service: "orbiq-web",
      status: "ready",
    });

    const releaseBody = (await release.json()) as {
      channel: string;
      commit: string;
      release: string;
      service: string;
      version: string;
    };

    expect(releaseBody.service).toBe("orbiq-web");
    expect(releaseBody.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(releaseBody.release.length).toBeGreaterThan(0);
    expect(["local", "ci", "preview", "production"]).toContain(
      releaseBody.channel,
    );
    expect(release.headers()["cache-control"]).toContain("no-store");
  });

  test("o comando release:drill verifica o standalone sem deploy ou reset destrutivo", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    const source = await readFile("scripts/release-drill.mjs", "utf8");

    expect(packageJson.scripts?.["release:drill"]).toBe(
      "node scripts/release-drill.mjs",
    );
    expect(source).toContain('pnpmArgs(["build:web"])');
    expect(source).toContain('process.execPath, ["scripts/standalone.mjs"]');
    expect(source).toContain('/api/health');
    expect(source).toContain('/api/ready');
    expect(source).toContain('/api/release');
    expect(source).toContain('ORBIQ_RELEASE_SHA');
    expect(source).toContain('Nenhum deploy externo ou reset destrutivo foi executado.');
    expect(source).not.toContain("supabase db reset");
  });
});
