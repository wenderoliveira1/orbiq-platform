import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BO — Funilaria/voz seguem o tema claro/escuro", () => {
  test("atalhos do orçamento não forçam fundo branco", async () => {
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(css).toContain(".quote-ops-funilaria.is-ops-primary");
    expect(css).toContain(".quote-service-modes button.is-active");
    expect(css).not.toMatch(
      /\.funilaria-guided-picker\.is-ops-primary\s*\{[^}]*#fff/s,
    );
    expect(css).not.toMatch(/\.quote-service-modes button\.is-active\s*\{[^}]*background:\s*#fff/s);
    expect(css).not.toMatch(/\.quote-voice-mic\s*\{[^}]*#fff5f5/s);
    expect(css).toContain("var(--orbiq-surface)");
    expect(css).toContain("var(--orbiq-surface-soft)");
  });
});
