import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AX — tipografia Inter + densidade comercial", () => {
  test("dashboard usa Inter via next/font e body legível ≥14px", async () => {
    const layout = await readFile("apps/web/src/app/layout.tsx", "utf8");
    const globals = await readFile("apps/web/src/app/globals.css", "utf8");
    const dashboard = await readFile(
      "apps/web/src/app/dashboard/dashboard.css",
      "utf8",
    );

    expect(layout).toContain('from "next/font/google"');
    expect(layout).toContain("Inter");
    expect(layout).toContain('variable: "--font-orbiq"');
    expect(layout).toContain("inter.className");
    expect(globals).toContain("--font-ui");
    expect(globals).toContain("font-size: 14px");
    expect(dashboard).toContain("--orbiq-font");
    expect(dashboard).toContain("var(--font-orbiq)");
    expect(dashboard).toMatch(/body\s*\{[\s\S]*?font-size:\s*14px/);
  });

  test("comercial: totais sticky, CTA claro e form densificado", async () => {
    const form = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/commercial-form.tsx",
      "utf8",
    );
    const page = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/page.tsx",
      "utf8",
    );
    const css = await readFile(
      "apps/web/src/app/dashboard/dashboard.css",
      "utf8",
    );

    expect(form).toContain("commercial-save-button");
    expect(form).toContain("Salvar comercial");
    expect(form).not.toContain("commercial-fast-path");
    expect(page).toContain("<WorkshopLetterhead");
    expect(page).toContain("<ReopenLockedQuote");
    expect(css).toMatch(
      /\.commercial-final-card\s*\{[\s\S]*?position:\s*sticky/,
    );
    expect(css).toContain(".commercial-save-button");
    expect(css).toMatch(
      /\.commercial-item-row\s*\{[\s\S]*?min-height:\s*52px/,
    );
    expect(css).toMatch(
      /\.commercial-sale-input,\s*\.commercial-cost-input input\s*\{[\s\S]*?font-size:\s*14px/,
    );
  });

  test("não regressa letterhead, reopen nem classes de lucro", async () => {
    const form = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/commercial-form.tsx",
      "utf8",
    );
    const page = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/page.tsx",
      "utf8",
    );
    const letterhead = await readFile(
      "apps/web/src/app/dashboard/_components/workshop-letterhead.tsx",
      "utf8",
    );
    const reopen = await readFile(
      "apps/web/src/app/dashboard/_components/reopen-locked-quote.tsx",
      "utf8",
    );

    expect(letterhead).toContain("Powered by Orbiq");
    expect(reopen).toContain('confirmation.trim().toLowerCase() === "sim"');
    expect(page).toContain("WorkshopLetterhead");
    expect(page).toContain("ReopenLockedQuote");
    expect(form).toContain("commercial-markup-input");
    expect(form).toContain("applyLucro");
    expect(form).toContain("marginPercent");
  });
});
