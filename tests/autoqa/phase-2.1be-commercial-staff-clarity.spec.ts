import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BE — comercial interno: Peças vs Mão de obra", () => {
  test("formulário staff separa Peças, Mão de obra e Lucro com totais claros", async () => {
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

    expect(form).toContain('data-testid="commercial-parts-section"');
    expect(form).toContain("Peças (custo e venda)");
    expect(form).toContain("Separado da mão de obra");
    expect(form).toContain('data-testid="commercial-staff-totals"');
    expect(form).toContain('data-testid="commercial-total-parts-sale"');
    expect(form).toContain('data-testid="commercial-total-labor-sale"');
    expect(form).toContain('data-testid="commercial-total-parts-cost"');
    expect(form).toContain('data-testid="commercial-total-profit"');
    expect(form).toContain("Venda peças");
    expect(form).toContain("Venda mão de obra");
    expect(form).toContain("Lucro bruto peças");
    expect(form).toContain("Subtotal (venda)");
    expect(form).toContain("TOTAL DO CLIENTE (VENDA)");
    expect(form).toContain('data-testid="commercial-final-sale-card"');
    expect(form).toContain("Peças {money(partsSale)} + Mão de obra {money(laborTotal)}");

    // Kickers keep categories distinct in the summary cards
    expect(form).toContain("PEÇAS");
    expect(form).toContain("MÃO DE OBRA");
    expect(form).toContain("LUCRO (OFICINA)");
    expect(form).toContain("CUSTO (OFICINA)");

    expect(page).toContain('data-testid="commercial-labor-section"');
    expect(page).toContain("Mão de obra");
    expect(page).toContain("Não misturar com peças");

    expect(css).toContain(".commercial-staff-totals");
    expect(css).toContain(".commercial-total-kicker");
    expect(css).toContain(".commercial-final-breakdown");
  });

  test("não reintroduz custo/lucro nas views do cliente", async () => {
    const cliente = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/page.tsx",
      "utf8",
    );
    const publico = await readFile(
      "apps/web/src/app/orcamento/[token]/page.tsx",
      "utf8",
    );

    for (const [label, source] of [
      ["cliente", cliente],
      ["publico", publico],
    ] as const) {
      expect(source, label).not.toMatch(/\bcusto\b/i);
      expect(source, label).not.toMatch(/\blucro\b/i);
      expect(source, label).not.toMatch(/\bmargem\b/i);
      expect(source, label).toContain("Totais (venda)");
      expect(source, label).toContain("Peças");
      expect(source, label).toContain("Mão de obra");
    }
  });
});
