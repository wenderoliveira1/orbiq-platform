import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BA — guarda de preço + remover linhas + badge Rascunho", () => {
  test("Novo Orçamento exige reconhecimento antes de salvar peças sem preço", async () => {
    const builder = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-builder.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(builder).toContain("partsWithoutPrice");
    expect(builder).toContain("missingPriceAcknowledged");
    expect(builder).toContain('data-testid="quote-missing-price-guard"');
    expect(builder).toContain('data-testid="quote-missing-price-ack"');
    expect(builder).toContain("Peças sem custo/preço");
    expect(builder).toContain("Entendi — posso salvar sem preço nestas peças");
    expect(builder).toContain("CONFIRMAR E SALVAR");
    expect(builder).toContain("handleFormSubmit");
    expect(builder).not.toContain("manualCostMissing");
    expect(css).toContain(".quote-missing-price-guard");
  });

  test("detalhe permite remover serviço e peça com confirmação e lock comercial", async () => {
    const page = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/actions.ts",
      "utf8",
    );
    const confirm = await readFile(
      "apps/web/src/app/dashboard/_components/confirm-submit-button.tsx",
      "utf8",
    );

    expect(actions).toContain("export async function deleteQuoteServiceAction");
    expect(actions).toContain("export async function deleteQuoteItemAction");
    expect(actions).toContain("assertQuoteNotCommerciallyLocked");
    expect(page).toContain("deleteQuoteItemAction");
    expect(page).toContain("deleteQuoteServiceAction");
    expect(page).toContain("ConfirmSubmitButton");
    expect(page).toContain('data-testid="quote-remove-service"');
    expect(page).toContain('data-testid="quote-remove-item"');
    expect(page).toContain("Remover");
    expect(confirm).toContain("window.confirm");
    expect(confirm).toContain('"use client"');
  });

  test("lista marca estimating como Rascunho e finalização sai do rascunho", async () => {
    const meta = await readFile(
      "apps/web/src/app/dashboard/orcamentos/quote-meta.ts",
      "utf8",
    );
    const list = await readFile(
      "apps/web/src/app/dashboard/orcamentos/page.tsx",
      "utf8",
    );
    const novoActions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(meta).toContain('value: "estimating"');
    expect(meta).toContain('label: "Rascunho"');
    expect(list).toContain("draftQuotes");
    expect(list).toContain("Rascunhos");
    expect(list).toContain('data-testid=');
    expect(list).toContain("quote-draft-badge");
    expect(css).toContain(".status-estimating");
    expect(novoActions).toContain("finalizedStatus");
    expect(novoActions).toContain("awaiting_quote");
    expect(novoActions).toContain("awaiting_evaluation");
    expect(novoActions).not.toContain('formData.get("');
    expect(novoActions).not.toContain("error.message");
  });
});
