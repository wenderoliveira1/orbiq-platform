import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AY — duplicar orçamento + adicionar linhas no detalhe", () => {
  test("ações de duplicar e adicionar peça/serviço existem com trava comercial", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/actions.ts",
      "utf8",
    );
    const detail = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const list = await readFile(
      "apps/web/src/app/dashboard/orcamentos/page.tsx",
      "utf8",
    );

    expect(actions).toContain("duplicateQuoteAction");
    expect(actions).toContain("addQuoteItemAction");
    expect(actions).toContain('create_quote_with_quantities');
    expect(actions).toContain("chosen_amount: null");
    expect(actions).toContain("sale_unit_amount: null");
    expect(actions).toContain("assertQuoteNotCommerciallyLocked");
    expect(actions).toContain("service_catalog_id");

    expect(detail).toContain("duplicateQuoteAction");
    expect(detail).toContain("Duplicar");
    expect(detail).toContain("addQuoteItemAction");
    expect(detail).toContain("QuoteAppendWithVoice");

    const append = await readFile(
      "apps/web/src/app/dashboard/orcamentos/_components/quote-append-with-voice.tsx",
      "utf8",
    );
    expect(append).toContain('name="service_catalog_id"');
    expect(append).toContain("+ Serviço");
    expect(append).toContain("+ Peça");
    expect(detail).toContain('commercial_status === "approved"');

    expect(list).toContain("duplicateQuoteAction");
    expect(list).toContain("Duplicar");
    expect(list).toContain("quote-history-duplicate");
    expect(list).toContain('value="list"');
    expect(list).toContain("quote-history-main");
  });

  test("densidade da lista e estilos de append permanecem", async () => {
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");
    expect(css).toMatch(/\.quote-history-row\s*\{[^}]*min-height:\s*54px/s);
    expect(css).toContain(".quote-history-main");
    expect(css).toContain(".quote-append-form");
    expect(css).toContain(".quote-history-duplicate");
  });

  test("não regressa Inter, letterhead nem lucro", async () => {
    const layout = await readFile("apps/web/src/app/layout.tsx", "utf8");
    const letterhead = await readFile(
      "apps/web/src/app/dashboard/_components/workshop-letterhead.tsx",
      "utf8",
    );
    const form = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/commercial-form.tsx",
      "utf8",
    );

    expect(layout).toContain("Inter");
    expect(letterhead).toContain("Powered by Orbiq");
    expect(form).toContain("applyLucro");
    expect(form).toContain("marginPercent");
  });
});
