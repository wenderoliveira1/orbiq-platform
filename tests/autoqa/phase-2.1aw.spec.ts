import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1AW — busca/paginação no novo orçamento + descrição editável", () => {
  test("Novo Orçamento filtra clientes, veículos e catálogo com paginação", async () => {
    const builder = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-builder.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(builder).toContain("PICKER_PAGE_SIZE");
    expect(builder).toContain("CATALOG_PAGE_SIZE");
    expect(builder).toContain('placeholder="Buscar nome ou telefone"');
    expect(builder).toContain("Buscar placa ou modelo");
    expect(builder).toContain('placeholder="Buscar serviço no catálogo"');
    expect(builder).toContain("Mostrar mais");
    expect(builder).toContain("Mostrar mais serviços");
    expect(builder).toContain('name="customer_id"');
    expect(builder).toContain('name="vehicle_id"');
    expect(css).toContain(".quote-picker-field");
    expect(css).toContain(".quote-catalog-more");
  });

  test("lista de orçamentos permanece densa sem RESULTADOS", async () => {
    const list = await readFile(
      "apps/web/src/app/dashboard/orcamentos/page.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(list).not.toContain("RESULTADOS");
    expect(list).toContain("quote-history-customer");
    expect(list).toContain("orbiq-plate");
    expect(css).toContain("min-height: 54px");
    expect(css).toMatch(/\.quote-history-row\s*\{[^}]*min-height:\s*54px/s);
  });

  test("detalhe permite editar descrição de serviço e peça com trava comercial", async () => {
    const page = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const actions = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/actions.ts",
      "utf8",
    );

    expect(actions).toContain("updateQuoteServiceDescriptionAction");
    expect(actions).toContain("updateQuoteItemDescriptionAction");
    expect(actions).toContain("assertQuoteNotCommerciallyLocked");
    expect(actions).toContain("description.length > 300");
    expect(page).toContain("updateQuoteServiceDescriptionAction");
    expect(page).toContain("updateQuoteItemDescriptionAction");
    expect(page).toContain('name="description"');
    expect(page).toContain(">Salvar</button>");
    expect(page).toContain('commercial_status === "approved"');
  });
});
