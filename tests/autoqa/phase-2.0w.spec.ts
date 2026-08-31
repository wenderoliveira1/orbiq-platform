import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.0W - logs de CI sem credenciais locais", () => {
  test("suprime a saída do Supabase Start e falha fechada sem imprimir segredos", async () => {
    const source = await readFile("scripts/quality-gate.mjs", "utf8");

    expect(source).toContain('run("Supabase Start", "pnpm", ["exec", "supabase", "start"], {');
    expect(source).toContain("capture: true");
    expect(source).toContain("sensitive: true");
    expect(source).toContain("Saída do comando suprimida por conter credenciais locais de desenvolvimento.");
    expect(source).toContain("Detalhes do status foram suprimidos para evitar exposição de credenciais locais.");

    const startIndex = source.indexOf('run("Supabase Start"');
    const sensitiveIndex = source.indexOf("sensitive: true", startIndex);
    expect(startIndex).toBeGreaterThan(-1);
    expect(sensitiveIndex).toBeGreaterThan(startIndex);
  });

  test("continua permitindo saída capturada para comandos não sensíveis", async () => {
    const source = await readFile("scripts/quality-gate.mjs", "utf8");

    expect(source).toContain("if (options.sensitive)");
    expect(source).toContain("if (options.capture && result.stdout)");
    expect(source).toContain("if (options.capture && result.stderr)");
    expect(source).toMatch(/run\(\s*"Gerando Database Types"[\s\S]*?\{\s*capture:\s*true\s*\}/);
  });
});
