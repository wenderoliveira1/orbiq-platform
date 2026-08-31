import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("Fase 2.1B - mascaramento de credenciais locais no CI", () => {
  test("mascara a chave local antes de exportá-la para passos seguintes", async () => {
    const workflow = await readFile(".github/workflows/autoqa.yml", "utf8");
    const maskIndex = workflow.indexOf('echo "::add-mask::$PUBLIC_KEY"');
    const envIndex = workflow.indexOf('echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLIC_KEY"');

    expect(maskIndex).toBeGreaterThan(-1);
    expect(envIndex).toBeGreaterThan(maskIndex);
    expect(workflow).toContain('echo "::add-mask::$ANON_KEY"');
    expect(workflow).toContain('echo "::add-mask::$PUBLISHABLE_KEY"');
  });

  test("mantém o ambiente isolado sem introduzir credenciais de produção", async () => {
    const workflow = await readFile(".github/workflows/autoqa.yml", "utf8");

    expect(workflow).toContain('AUTOQA_SUPABASE_URL=$API_URL');
    expect(workflow).toContain('AUTOQA_SUPABASE_PUBLIC_KEY=$PUBLIC_KEY');
    expect(workflow).not.toContain("SERVICE_ROLE_KEY");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
