import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { compactQuoteProtocol } from "../../apps/web/src/app/dashboard/_lib/compact-quote-protocol";

test.describe("Fase 2.1BK — protocolo curto no documento do cliente", () => {
  test("remove a hora do protocolo longo", () => {
    expect(compactQuoteProtocol("ORB-260914-131120-5AA6")).toBe("ORB-260914-5AA6");
    expect(compactQuoteProtocol("orb-260914-000001-ab12")).toBe("ORB-260914-AB12");
    expect(compactQuoteProtocol("ORB-260914-5AA6")).toBe("ORB-260914-5AA6");
    expect(compactQuoteProtocol("")).toBe("");
  });

  test("folha do cliente e link público usam compactQuoteProtocol", async () => {
    const cliente = await readFile(
      "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/page.tsx",
      "utf8",
    );
    const publico = await readFile("apps/web/src/app/orcamento/[token]/page.tsx", "utf8");
    const letterhead = await readFile(
      "apps/web/src/app/dashboard/_components/workshop-letterhead.tsx",
      "utf8",
    );
    const migration = await readFile(
      "supabase/migrations/20260914120000_short_quote_protocol.sql",
      "utf8",
    );

    expect(cliente).toContain("compactQuoteProtocol");
    expect(publico).toContain("compactQuoteProtocol");
    expect(letterhead).toContain("compactQuoteProtocol");
    expect(migration).toContain("orbiq_next_quote_protocol");
    expect(migration).toContain("to_char(clock_timestamp(), 'YYMMDD')");
    expect(migration).not.toContain("service_role");
  });
});
