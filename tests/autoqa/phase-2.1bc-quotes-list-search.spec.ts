import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  matchesQuoteListSearch,
  quotesListHref,
} from "../../apps/web/src/app/dashboard/orcamentos/quote-list-filter";

test.describe("Fase 2.1BC — lista de orçamentos: busca/filtro denso", () => {
  test("lista busca por cliente, placa, protocolo ORB e status incl. Rascunho", async () => {
    const list = await readFile(
      "apps/web/src/app/dashboard/orcamentos/page.tsx",
      "utf8",
    );
    const meta = await readFile(
      "apps/web/src/app/dashboard/orcamentos/quote-meta.ts",
      "utf8",
    );
    const filter = await readFile(
      "apps/web/src/app/dashboard/orcamentos/quote-list-filter.ts",
      "utf8",
    );

    expect(list).toContain('data-testid="quote-history-search"');
    expect(list).toContain('data-testid="quote-history-search-q"');
    expect(list).toContain('data-testid="quote-history-search-status"');
    expect(list).toContain('placeholder="Cliente, placa ou ORB-…"');
    expect(list).toContain("matchesQuoteListSearch");
    expect(list).toContain("quotesListHref");
    expect(list).toContain('data-testid="quote-history-metrics"');
    // Metrics use data-testid={metric.testId}; drafts id lives on the metrics array.
    expect(list).toContain('testId: "quote-metric-drafts"');
    expect(list).toContain("quote-metric-drafts");
    expect(list).toContain("data-testid={metric.testId}");
    expect(list).toContain("Rascunhos");
    expect(list).toContain('data-testid="quote-draft-badge"');
    expect(list).toContain("QUOTE_STATUSES.map");
    expect(list).not.toContain("RESULTADOS");

    expect(meta).toContain('value: "estimating"');
    expect(meta).toContain('label: "Rascunho"');

    expect(filter).toContain("matchesQuoteListSearch");
    expect(filter).toContain("compactSearchToken");
    expect(filter).toContain("quotesListHref");
    expect(filter).toContain("ORB");
  });

  test("métricas densas e barra de busca compacta no CSS", async () => {
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(css).toContain(".quote-history-metric");
    expect(css).toMatch(
      /\.quote-history-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s,
    );
    expect(css).toMatch(
      /\.quote-history-metric\s*\{[^}]*min-height:\s*68px/s,
    );
    expect(css).toMatch(
      /\.quote-history-search input,\s*\n\.quote-history-search select,\s*\n\.quote-status-form select\s*\{[^}]*min-height:\s*36px/s,
    );
    expect(css).toContain(".quote-history-metric.is-active");
    expect(css).toMatch(/\.quote-history-row\s*\{[^}]*min-height:\s*54px/s);
  });

  test("helper casa placa sem hífen e protocolo ORB", async () => {
    expect(
      matchesQuoteListSearch("abc1d23", {
        plate: "ABC-1D23",
        protocol: "ORB-2026-001",
        customerName: "Maria Silva",
      }),
    ).toBe(true);

    expect(
      matchesQuoteListSearch("ORB-2026", {
        plate: "ABC1D23",
        protocol: "ORB-2026-001",
        customerName: "João",
      }),
    ).toBe(true);

    expect(
      matchesQuoteListSearch("maria", {
        plate: "ABC1D23",
        protocol: "ORB-1",
        customerName: "Maria Silva",
      }),
    ).toBe(true);

    expect(
      matchesQuoteListSearch("xyz", {
        plate: "ABC1D23",
        protocol: "ORB-1",
        customerName: "Maria",
      }),
    ).toBe(false);

    expect(quotesListHref({ q: "ORB-1", status: "estimating" })).toBe(
      "/dashboard/orcamentos?q=ORB-1&status=estimating",
    );
    expect(quotesListHref({})).toBe("/dashboard/orcamentos");
  });

  test("não regressa Inter, letterhead nem badge Rascunho", async () => {
    const layout = await readFile("apps/web/src/app/layout.tsx", "utf8");
    const letterhead = await readFile(
      "apps/web/src/app/dashboard/_components/workshop-letterhead.tsx",
      "utf8",
    );
    const list = await readFile(
      "apps/web/src/app/dashboard/orcamentos/page.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(layout).toContain("Inter");
    expect(letterhead).toContain("Powered by Orbiq");
    expect(list).toContain("quote-draft-badge");
    expect(css).toContain(".status-estimating");
  });
});
