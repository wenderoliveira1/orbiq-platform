import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AV — reabrir orçamento bloqueado + cabeçalho da folha", () => {
  test("exige confirmação sim e usa reopen_quote_commercial", async () => {
    const action = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/actions.ts",
      "utf8",
    );
    const reopenUi = await readFile(
      "apps/web/src/app/dashboard/_components/reopen-locked-quote.tsx",
      "utf8",
    );
    const commercialPage = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/page.tsx",
      "utf8",
    );
    const quoteDetail = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const quoteActions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/actions.ts",
      "utf8",
    );

    expect(action).toContain("reopen_quote_commercial");
    expect(action).toContain('confirmation !==\n      "sim"');
    expect(action).toContain('Digite "sim" para confirmar a reabertura do orçamento.');
    expect(reopenUi).toContain("Reabrir para editar");
    expect(reopenUi).toContain('confirmation.trim().toLowerCase() === "sim"');
    expect(reopenUi).toContain("pode já ter sido enviado ou apresentado ao cliente");
    expect(commercialPage).toContain("<ReopenLockedQuote");
    expect(commercialPage).toContain("<WorkshopLetterhead");
    expect(commercialPage).not.toContain("ORÇAMENTO COMERCIAL");
    expect(quoteDetail).toContain("<ReopenLockedQuote");
    expect(quoteDetail).toContain('commercial_status === "approved"');
    expect(quoteActions).toContain("assertQuoteNotCommerciallyLocked");
  });

  test("mantém workshop no cabeçalho da folha e Orbiq no powered-by", async () => {
    const letterhead = await readFile(
      "apps/web/src/app/dashboard/_components/workshop-letterhead.tsx",
      "utf8",
    );
    const cliente = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/page.tsx",
      "utf8",
    );
    const publicQuote = await readFile(
      "apps/web/src/app/orcamento/[token]/page.tsx",
      "utf8",
    );
    const layout = await readFile("apps/web/src/app/dashboard/layout.tsx", "utf8");
    const orcamentos = await readFile(
      "apps/web/src/app/dashboard/orcamentos/page.tsx",
      "utf8",
    );

    expect(letterhead).toContain("workshop-letterhead-name");
    expect(letterhead).toContain("Powered by Orbiq");
    expect(letterhead).toContain("workshop-letterhead-powered");
    expect(cliente).toContain("customer-quote-letterhead");
    expect(cliente).toContain("Validade comercial:");
    expect(cliente).toContain("Powered by Orbiq");
    expect(publicQuote).toContain("public-quote-letterhead");
    expect(publicQuote).toContain("Powered by Orbiq");
    expect(layout).toContain("<strong>Orbiq</strong>");
    expect(orcamentos).not.toContain("RESULTADOS");
  });

  test("permite editar identidade do orçamento e exibe marca Orbiq no chrome", async () => {
    const quoteDetail = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const quoteActions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/actions.ts",
      "utf8",
    );
    const layout = await readFile("apps/web/src/app/dashboard/layout.tsx", "utf8");
    const mobile = await readFile(
      "apps/web/src/app/dashboard/mobile-navigation.tsx",
      "utf8",
    );
    const login = await readFile("apps/web/src/app/login/page.tsx", "utf8");

    expect(quoteActions).toContain("updateQuoteIdentityAction");
    expect(quoteActions).toContain('section === "customer"');
    expect(quoteActions).toContain('section === "vehicle"');
    expect(quoteActions).toContain("assertQuoteNotCommerciallyLocked");
    expect(quoteDetail).toContain("updateQuoteIdentityAction");
    expect(quoteDetail).toContain("Salvar cliente");
    expect(quoteDetail).toContain("Salvar veículo");
    expect(quoteDetail).toContain('name="mileage"');
    expect(quoteDetail).toContain('name="plate"');
    expect(layout).toContain('/brand/orbiq-mark.png');
    expect(layout).toContain("<strong>Orbiq</strong>");
    expect(mobile).toContain('/brand/orbiq-mark.png');
    expect(login).toContain('/brand/orbiq-mark.png');
    expect(login).toContain("Entrar no Orbiq");
  });
});
