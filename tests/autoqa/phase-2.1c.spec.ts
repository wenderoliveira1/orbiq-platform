import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1C - AutoQA sem identificadores nos logs", () => {
  test("não imprime identidade sintética nem prefixo de token", async () => {
    const source = await readFile("tests/autoqa/global.setup.ts", "utf8");

    expect(source).toContain(
      "[AUTOQA] Identificadores sintéticos mantidos somente no estado local do teste.",
    );
    expect(source).not.toContain("Oficina sintética: ${organizationId}");
    expect(source).not.toContain("Usuário sintético: ${email}");
    expect(source).not.toContain("token.slice(");
    expect(source).not.toContain("Linha de validade inválida no AutoQA: ${line}");
  });

  test("preserva os identificadores no estado privado necessário aos testes", async () => {
    const source = await readFile("tests/autoqa/global.setup.ts", "utf8");

    expect(source).toContain("const state: AutoQaState = {");
    expect(source).toContain("email,");
    expect(source).toContain("password,");
    expect(source).toContain("organizationId,");
    expect(source).toContain("publicApproveToken,");
    expect(source).toContain("publicRejectToken,");
    expect(source).toContain("JSON.stringify(state, null, 2)");
  });
});
