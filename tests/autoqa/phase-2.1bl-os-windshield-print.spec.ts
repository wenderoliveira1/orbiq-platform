import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const WINDSHIELD = "apps/web/src/app/dashboard/execucao/[workOrderId]/parabrisa/page.tsx";

const FORBIDDEN = [
  /\blabor_amount\b/,
  /\bchosen_amount\b/,
  /\bsale_unit_amount\b/,
  /\bsale_total_amount\b/,
  /\bcusto\b/i,
  /\blucro\b/i,
  /\bmargem\b/i,
  /\bR\$\b/,
  /\bcurrency\b/,
];

test.describe("Fase 2.1BL — OS de parabrisa sem valores", () => {
  test("folha da OS não carrega nem mostra preço", async () => {
    const source = await readFile(WINDSHIELD, "utf8");
    for (const pattern of FORBIDDEN) {
      expect(source, `OS parabrisa não pode conter ${pattern}`).not.toMatch(pattern);
    }

    expect(source).toContain('data-testid="os-windshield"');
    expect(source).toContain('data-testid="os-windshield-plate"');
    expect(source).toContain('data-testid="os-windshield-services"');
    expect(source).toContain("Serviços a executar");
    expect(source).toContain("Sem valores");
    expect(source).toContain("needs_part");
    expect(source).not.toContain("service_role");
  });

  test("execução oferece imprimir OS", async () => {
    const detail = await readFile(
      "apps/web/src/app/dashboard/execucao/[workOrderId]/page.tsx",
      "utf8",
    );
    const list = await readFile("apps/web/src/app/dashboard/execucao/page.tsx", "utf8");

    expect(detail).toContain("/parabrisa");
    expect(detail).toContain('data-testid="os-windshield-open"');
    expect(list).toContain("/parabrisa");
    expect(list).toContain("Parabrisa");
  });
});
