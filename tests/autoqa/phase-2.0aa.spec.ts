import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0AA - recuperação profissional do dashboard", () => {
  test("mantém uma Error Boundary autenticada, recuperável e sem detalhes internos", async () => {
    const source = await readFile("apps/web/src/app/dashboard/error.tsx", "utf8");

    expect(source).toContain('"use client";');
    expect(source).toContain("data-testid=\"dashboard-error-boundary\"");
    expect(source).toContain("onClick={reset}");
    expect(source).toContain('href="/dashboard"');
    expect(source).toContain('href="/dashboard/suporte"');
    expect(source).toContain("orbiq.client.dashboard_error");
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("error.stack");
  });

  test("mantém a recuperação utilizável no desktop e no mobile", async () => {
    const css = await readFile(
      "apps/web/src/app/dashboard/dashboard-error.module.css",
      "utf8",
    );

    expect(css).toContain("min-height: min(620px, calc(100dvh - 68px));");
    expect(css).toContain("@media (max-width: 620px)");
    expect(css).toContain("width: 100%;");
  });
});
