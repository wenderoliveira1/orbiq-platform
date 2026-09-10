import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AZ — rascunho contínuo do Novo Orçamento + preço no detalhe", () => {
  test("helpers de draft: chave, parse, meaningful e sync threshold", async () => {
    const source = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-builder-draft.ts",
      "utf8",
    );

    expect(source).toContain("export function quoteBuilderDraftStorageKey");
    expect(source).toContain("orbiq:quote-builder-draft:v1:");
    expect(source).toContain("export function parseQuoteBuilderDraft");
    expect(source).toContain("export function isMeaningfulQuoteBuilderDraft");
    expect(source).toContain("export function canSyncQuoteBuilderDraftToServer");
    expect(source).toContain("export function readQuoteBuilderDraft");
    expect(source).toContain("export function writeQuoteBuilderDraft");
    expect(source).toContain("export function clearQuoteBuilderDraft");
    expect(source).toContain("QUOTE_BUILDER_DRAFT_DEBOUNCE_MS");
    expect(source).toContain("window.localStorage");
  });

  test("builder restaura rascunho, descarta e limpa no submit", async () => {
    const builder = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-builder.tsx",
      "utf8",
    );
    const page = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/page.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(builder).toContain("readQuoteBuilderDraft");
    expect(builder).toContain("writeQuoteBuilderDraft");
    expect(builder).toContain("clearQuoteBuilderDraft");
    expect(builder).toContain("Rascunho restaurado");
    expect(builder).toContain("Descartar rascunho");
    expect(builder).toContain('data-testid="quote-draft-restored"');
    expect(builder).toContain('data-testid="quote-draft-discard"');
    expect(builder).toContain('name="draft_quote_id"');
    expect(builder).toContain("upsertQuoteBuilderDraftAction");
    expect(builder).toContain("discardQuoteBuilderServerDraftAction");
    expect(builder).toContain("onSubmit={handleFormSubmit}");
    expect(builder).toContain("window.setTimeout");
    expect(page).toContain("organizationId={organization.id}");
    expect(page).toContain("userId={user.id}");
    expect(css).toContain(".quote-draft-banner");
  });

  test("actions criam/atualizam rascunho no servidor e finalizam o mesmo id", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/actions.ts",
      "utf8",
    );

    expect(actions).toContain("export async function upsertQuoteBuilderDraftAction");
    expect(actions).toContain("export async function discardQuoteBuilderServerDraftAction");
    expect(actions).toContain("replaceDraftQuoteLines");
    expect(actions).toContain('singleRawText(formData, "draft_quote_id")');
    expect(actions).toContain("finalizedQuoteId");
  });

  test("detalhe permite editar custo/venda da peça quando não travado comercialmente", async () => {
    const page = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/actions.ts",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(actions).toContain("export async function updateQuoteItemPriceAction");
    expect(actions).toContain('formData.get("cost_unit_amount")');
    expect(actions).toContain('formData.get("sale_unit_amount")');
    expect(actions).toContain('purchase_status: chosenAmount !== null ? "approved" : "pending"');
    expect(actions).toContain("assertQuoteNotCommerciallyLocked");
    expect(page).toContain("updateQuoteItemPriceAction");
    expect(page).toContain('name="cost_unit_amount"');
    expect(page).toContain('name="sale_unit_amount"');
    expect(page).toContain("Salvar preço");
    expect(page).toContain('data-testid="quote-item-price-form"');
    expect(page).toContain('commercial_status === "approved"');
    expect(page).toContain("sale_unit_amount");
    expect(css).toContain(".quote-item-price-form");
  });
});
