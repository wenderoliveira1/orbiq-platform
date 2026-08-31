import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0AA - recuperação profissional do dashboard", () => {
  test("mantém recuperação autenticada, rastreável e com suporte", async () => {
    const source = await readFile("apps/web/src/app/dashboard/error.tsx", "utf8");

    expect(source).toContain('"use client";');
    expect(source).toContain("reportIncidentAction");
    expect(source).toContain('source: "dashboard_error"');
    expect(source).toContain("onClick={reset}");
    expect(source).toContain('href="/dashboard"');
    expect(source).toContain('href="/dashboard/suporte"');
    expect(source).not.toContain("{error.message}");
    expect(source).not.toContain("{error.stack}");
  });

  test("mantém ações acessíveis e responsivas na tela de recuperação", async () => {
    const css = await readFile("apps/web/src/app/system-state.module.css", "utf8");

    expect(css).toContain(".primaryAction:focus-visible");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".primaryAction,\n  .secondaryAction {\n    width: 100%;");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
