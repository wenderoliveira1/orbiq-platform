import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BG — impressão profissional compacta A4 (sem custo/lucro)", () => {
  test("CSS de print do detalhe é denso, esconde vazios e economia interna", async () => {
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
    expect(css).toMatch(/margin:\s*8mm/);
    expect(css).toContain(".print-hide-empty");
    expect(css).toContain(".quote-internal-economics");
    expect(css).toContain("quote-detail-grid");
    expect(css).toContain("grid-template-columns: 1fr 1fr");

    expect(detail).toContain("print-hide-empty");
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

    expect(printButton).toContain("documentTitle");
    expect(printButton).toContain('data-testid="quote-detail-print"');
  });

  test("folha do cliente e público: mão de obra → peças (venda) + print denso", async () => {
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

    expect(publicCss).toMatch(/margin:\s*8mm/);
    expect(publicCss).toContain(".public-hero");
    expect(publicCss).toMatch(/\.public-hero[\s\S]{0,120}?display:\s*none/i);
    expect(dashboardCss).toContain("customer-section-help");
    expect(dashboardCss).toMatch(
      /\.customer-section-help[\s\S]{0,80}?display:\s*none/i,
    );
  });
});
