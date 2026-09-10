import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const CLIENT_VIEW_PATHS = [
  "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/page.tsx",
  "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/customer-quote-toolbar.tsx",
  "apps/web/src/app/orcamento/[token]/page.tsx",
  "apps/web/src/app/orcamento/public-quote.css",
] as const;

const FORBIDDEN_CLIENT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "custo", pattern: /\bcusto\b/i },
  { label: "lucro", pattern: /\blucro\b/i },
  { label: "margem", pattern: /\bmargem\b/i },
  { label: "profit", pattern: /\bprofit\b/i },
  { label: "parts_cost", pattern: /\bparts_cost\b/i },
  { label: "chosen_amount", pattern: /\bchosen_amount\b/i },
  { label: "markup", pattern: /\bmarkup\b/i },
  { label: "purchase_status", pattern: /\bpurchase_status\b/i },
  { label: "saleFromLucro", pattern: /saleFromLucro|applyLucro/ },
];

test.describe("Fase 2.1BD — privacidade da folha do cliente (sem custo/lucro)", () => {
  test("views do cliente/público não expõem custo, lucro, margem ou compra", async () => {
    for (const relativePath of CLIENT_VIEW_PATHS) {
      const source = await readFile(relativePath, "utf8");
      for (const rule of FORBIDDEN_CLIENT_PATTERNS) {
        expect(
          source,
          `${relativePath} não pode expor "${rule.label}" ao cliente`,
        ).not.toMatch(rule.pattern);
      }
    }
  });

  test("folha do cliente separa Peças, Mão de obra e Totais de venda", async () => {
    const cliente = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/page.tsx",
      "utf8",
    );
    const publico = await readFile(
      "apps/web/src/app/orcamento/[token]/page.tsx",
      "utf8",
    );

    expect(cliente).toContain('data-testid="customer-quote-parts"');
    expect(cliente).toContain('data-testid="customer-quote-labor"');
    expect(cliente).toContain('data-testid="customer-quote-totals"');
    expect(cliente).toContain("Totais (venda)");
    expect(cliente).toContain("TOTAL A PAGAR");
    expect(cliente).toContain("sale_unit_amount");
    expect(cliente).toContain("sale_total_amount");
    expect(cliente).toContain("labor_amount");
    expect(cliente.indexOf("customer-quote-parts")).toBeLessThan(
      cliente.indexOf("customer-quote-labor"),
    );
    expect(cliente.indexOf("customer-quote-labor")).toBeLessThan(
      cliente.indexOf("customer-quote-totals"),
    );

    expect(publico).toContain('data-testid="public-quote-parts"');
    expect(publico).toContain('data-testid="public-quote-labor"');
    expect(publico).toContain('data-testid="public-quote-totals"');
    expect(publico).toContain("Totais (venda)");
    expect(publico).toContain("TOTAL A PAGAR");
    expect(publico.indexOf("public-quote-parts")).toBeLessThan(
      publico.indexOf("public-quote-labor"),
    );
  });

  test("impressão do detalhe interno esconde economia e prefere versão do cliente", async () => {
    const detail = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const css = await readFile(
      "apps/web/src/app/dashboard/dashboard.css",
      "utf8",
    );

    expect(detail).toContain("quote-internal-economics");
    expect(detail).toContain("quote-client-sale");
    expect(detail).toContain('data-testid="quote-detail-client-print"');
    expect(detail).toContain("/cliente");
    expect(detail).toContain("partsSaleTotal");
    expect(detail).toContain("printGrandTotal");
    // print-only price must not render chosen_amount as the client figure
    expect(detail).toMatch(
      /print-only quote-item-price-readonly quote-client-sale[\s\S]*?sale_total_amount/,
    );
    expect(css).toContain(".quote-internal-economics");
  });
});
