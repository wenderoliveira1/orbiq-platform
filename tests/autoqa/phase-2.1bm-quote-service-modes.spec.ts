import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1BM — abas práticas no passo Serviços", () => {
  test("Novo orçamento: um caminho de serviço por vez", async () => {
    const builder = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-builder.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(builder).toContain('data-testid="quote-service-work"');
    expect(builder).toContain('data-testid={`quote-service-mode-${mode}`}');
    expect(builder).toContain('["funilaria", "Funilaria"]');
    expect(builder).toContain('["catalogo", "Catálogo"]');
    expect(builder).not.toContain('data-testid="quote-service-mode-outras"');
    expect(builder).toContain('["manual", "Digitar"]');
    expect(builder).toContain('useState<ServiceAddMode>("funilaria")');
    expect(builder).toContain("quote-step-summary");
    expect(builder).not.toContain("<CategoryGuidedPicker");

    const funilariaIdx = builder.indexOf("<FunilariaGuidedPicker");
    expect(funilariaIdx).toBeGreaterThan(-1);

    expect(css).toContain(".quote-service-modes");
    expect(css).toContain(".quote-step-summary");
    expect(builder).not.toContain("service_role");
  });
});
