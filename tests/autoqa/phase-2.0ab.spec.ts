import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0AB - continuidade segura de suporte", () => {
  test("leva a referência de recuperação apenas pelo fragmento local", async () => {
    const errorSource = await readFile(
      "apps/web/src/app/dashboard/error.tsx",
      "utf8",
    );

    expect(errorSource).toContain(
      'href={\`/dashboard/suporte#referencia=\${encodeURIComponent(incidentId ?? fingerprint)}\`}',
    );
    expect(errorSource).not.toContain("?referencia=");
  });

  test("aceita somente referências previstas e inclui a confirmação no relatório seguro", async () => {
    const source = await readFile(
      "apps/web/src/app/dashboard/suporte/support-diagnostics.tsx",
      "utf8",
    );
    const css = await readFile(
      "apps/web/src/app/dashboard/suporte/support-diagnostics.module.css",
      "utf8",
    );

    expect(source).toContain("INCIDENT_REFERENCE_PATTERN");
    expect(source).toContain("window.location.hash");
    expect(source).toContain('new URLSearchParams(fragment).get("referencia")');
    expect(source).toContain(
      'referencia_incidente=\${supportReference ?? "nao_disponivel"}',
    );
    expect(source).toContain("Referência de recuperação incluída no relatório seguro.");
    expect(source).not.toContain("window.location.search");
    expect(css).toContain(".referenceNotice");
    expect(css).toContain("@media (max-width: 820px)");
  });
});
