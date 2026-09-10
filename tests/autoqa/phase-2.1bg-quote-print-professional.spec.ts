import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BG — impressão profissional compacta A4 (sem custo/lucro)", () => {
  test("CSS de print do detalhe é denso, esconde vazios via no-print (sem :has) e economia interna", async () => {
    const css = await readFile(
      "apps/web/src/app/dashboard/dashboard.css",
      "utf8",
    );
    const detail = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const printButton = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/print-button.tsx",
      "utf8",
    );

    expect(css).toMatch(/@page\s*\{[\s\S]*?size:\s*A4/i);
    expect(css).toMatch(/margin:\s*6mm/);
    expect(css).toContain(".quote-internal-economics");
    expect(css).toContain("quote-detail-grid");
    expect(css).toContain("grid-template-columns: 1fr 1fr");
    // Dense print rows — not wide multi-column service grids
    expect(css).toMatch(
      /\.quote-detail-table-row\.service-table\s*\{[\s\S]*?grid-template-columns:\s*1fr\s+auto/i,
    );
    // Do not trust :has() for print empty hiding
    expect(css).not.toMatch(
      /\.quote-detail-page[\s\S]{0,200}:has\(\s*>\s*\.orbiq-empty/,
    );

    // Empty sections gated with no-print (DOM omit for print path)
    expect(detail).toMatch(
      /quote-services-section\$\{services\.length === 0 \? " no-print"/,
    );
    expect(detail).toMatch(
      /quote-items-section\$\{items\.length === 0 \? " no-print"/,
    );
    expect(detail).toMatch(
      /orbiq-panel\$\{!quote\.notes \? " no-print"/,
    );
    expect(detail).toContain('className="orbiq-empty compact no-print"');
    expect(detail).toContain("Nenhuma peça registrada.");
    expect(detail).not.toContain("print-hide-empty");
    expect(detail).toContain("quote-internal-economics");
    expect(detail).toContain("quote-client-sale");
    expect(detail).toContain('data-testid="quote-detail-client-print"');
    expect(detail).toContain("Versão do cliente / Imprimir");
    expect(detail).toContain("partsSaleTotal");
    expect(detail).toContain("printGrandTotal");
    expect(detail).toMatch(
      /print-only quote-item-price-readonly quote-client-sale[\s\S]*?sale_total_amount/,
    );
    expect(detail).not.toMatch(
      /print-only quote-item-price-readonly[\s\S]{0,80}chosen_amount/,
    );
    // Labor totals row gated when no services
    expect(detail).toMatch(
      /services\.length > 0 \? \([\s\S]*?Mão de obra[\s\S]*?\) : null/,
    );

    expect(printButton).toContain("documentTitle");
    expect(printButton).toContain('data-testid="quote-detail-print"');
  });

  test("folha do cliente e público: omitem Peças/Mão de obra vazios + print denso", async () => {
    const cliente = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/page.tsx",
      "utf8",
    );
    const toolbar = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/customer-quote-toolbar.tsx",
      "utf8",
    );
    const publico = await readFile(
      "apps/web/src/app/orcamento/[token]/page.tsx",
      "utf8",
    );
    const publicCss = await readFile(
      "apps/web/src/app/orcamento/public-quote.css",
      "utf8",
    );
    const dashboardCss = await readFile(
      "apps/web/src/app/dashboard/dashboard.css",
      "utf8",
    );

    for (const source of [cliente, publico, toolbar]) {
      expect(source).not.toMatch(/\bcusto\b/i);
      expect(source).not.toMatch(/\blucro\b/i);
      expect(source).not.toMatch(/\bmargem\b/i);
      expect(source).not.toMatch(/\bchosen_amount\b/);
      expect(source).not.toMatch(/\bpurchase_status\b/);
    }

    // Parts still gated by items.length > 0
    expect(cliente).toMatch(
      /items\.length > 0 \? \([\s\S]*?data-testid="customer-quote-parts"/,
    );
    expect(publico).toMatch(
      /quote\.items\.length > 0 \? \([\s\S]*?data-testid="public-quote-parts"/,
    );

    // Labor gated by services.length > 0 — whole section omitted when empty
    expect(cliente).toMatch(
      /services\.length > 0 \? \([\s\S]*?data-testid="customer-quote-labor"/,
    );
    expect(publico).toMatch(
      /quote\.services\.length > 0 \? \([\s\S]*?data-testid="public-quote-labor"/,
    );
    expect(cliente).not.toContain("Sem mão de obra neste orçamento");
    expect(publico).not.toContain("Sem mão de obra neste orçamento");

    // Totals rows gated
    expect(cliente).toMatch(
      /services\.length > 0 \? \([\s\S]*?<span>Mão de obra<\/span>/,
    );
    expect(cliente).toMatch(
      /items\.length > 0 \? \([\s\S]*?<span>Peças<\/span>/,
    );
    expect(publico).toMatch(
      /quote\.services\.length > 0 \? \([\s\S]*?<span>Mão de obra<\/span>/,
    );
    expect(publico).toMatch(
      /quote\.items\.length > 0 \? \([\s\S]*?<span>Peças<\/span>/,
    );

    // No help paragraphs / duplicate label bloat
    expect(cliente).not.toContain("customer-section-help");
    expect(publico).not.toContain("public-section-help");
    expect(cliente).not.toContain('customer-section-label">MÃO DE OBRA');
    expect(cliente).not.toContain('customer-section-label">PEÇAS');

    // Decision block marked no-print on public
    expect(publico).toContain('className="public-decision no-print"');

    expect(cliente.indexOf("customer-quote-labor")).toBeLessThan(
      cliente.indexOf("customer-quote-parts"),
    );
    expect(publico.indexOf("public-quote-labor")).toBeLessThan(
      publico.indexOf("public-quote-parts"),
    );

    expect(cliente).toContain("sale_unit_amount");
    expect(cliente).toContain("sale_total_amount");
    expect(cliente).toContain("TOTAL A PAGAR");
    expect(toolbar).toContain('data-testid="customer-quote-print"');

    expect(publicCss).toMatch(/margin:\s*6mm/);
    expect(publicCss).toContain(".public-hero");
    expect(publicCss).toMatch(/\.public-hero[\s\S]{0,160}?display:\s*none/i);
    expect(publicCss).toMatch(/\.no-print[\s\S]{0,80}?display:\s*none/i);
    expect(dashboardCss).toMatch(
      /\.customer-section-help[\s\S]{0,80}?display:\s*none/i,
    );
  });

  test("fixture mental: zero peças / zero mão de obra não emitem blocos nem placeholders", async () => {
    const cliente = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/page.tsx",
      "utf8",
    );
    const publico = await readFile(
      "apps/web/src/app/orcamento/[token]/page.tsx",
      "utf8",
    );
    const detail = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const css = await readFile(
      "apps/web/src/app/dashboard/dashboard.css",
      "utf8",
    );

    // Simulate conditional: when items.length === 0 the parts testid is inside the truthy branch only
    const clientePartsBranch = cliente.match(
      /items\.length > 0 \? \(([\s\S]*?)\) : null/,
    );
    expect(clientePartsBranch?.[1] ?? "").toContain(
      'data-testid="customer-quote-parts"',
    );
    // Outside that branch there is no unconditional parts section
    const clienteWithoutPartsBranch = cliente.replace(
      /items\.length > 0 \? \([\s\S]*?\) : null/,
      "/* omitted parts */",
    );
    expect(clienteWithoutPartsBranch).not.toContain(
      'data-testid="customer-quote-parts"',
    );

    const publicPartsBranch = publico.match(
      /quote\.items\.length > 0 \? \(([\s\S]*?)\) : null/,
    );
    expect(publicPartsBranch?.[1] ?? "").toContain(
      'data-testid="public-quote-parts"',
    );
    const publicoWithoutParts = publico.replace(
      /quote\.items\.length > 0 \? \([\s\S]*?\) : null/,
      "/* omitted parts */",
    );
    expect(publicoWithoutParts).not.toContain(
      'data-testid="public-quote-parts"',
    );

    // Empty labor placeholder gone
    expect(cliente + publico).not.toContain(
      "Sem mão de obra neste orçamento",
    );

    // Detail empty piece copy is no-print only (never print CSS path)
    expect(detail).toMatch(
      /orbiq-empty compact no-print[\s\S]*?Nenhuma peça registrada/,
    );
    expect(css).toContain(".no-print");
    expect(css).toMatch(/\.no-print\s*\{[\s\S]*?display:\s*none\s*!important/i);
  });
});
