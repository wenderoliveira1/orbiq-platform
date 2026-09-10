import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const MIGRATION_PATH =
  "supabase/migrations/20260910220000_recalculate_quote_require_membership_or_service_role.sql";

test.describe("Fase 2.1BH — membership guard em recalculate_quote_final_amount", () => {
  test("migration exige membership na Data API e permite SQL direto/service_role", async () => {
    const migration = await readFile(MIGRATION_PATH, "utf8");

    expect(migration).toContain(
      "create or replace function public.recalculate_quote_final_amount",
    );
    expect(migration).toContain("security invoker");
    expect(migration).toContain("auth.role() is distinct from 'service_role'");
    expect(migration).toContain("auth.jwt() is not null");
    expect(migration).toContain("auth.uid() is null");
    expect(migration).toContain("public.is_org_member(target_org_id)");
    expect(migration).toContain(
      "revoke all on function public.recalculate_quote_final_amount(uuid) from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.recalculate_quote_final_amount(uuid) to authenticated",
    );
    expect(migration).not.toMatch(
      /if\s+auth\.uid\(\)\s+is\s+not\s+null\s+and\s+not\s+public\.is_org_member/,
    );
  });
});
