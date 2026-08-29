import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260829105000_quote_write_bounds.sql";

test.describe("Fase 2.0S - limites defensivos de escrita no banco", () => {
  test("espelha no PostgreSQL os limites críticos do formulário Web", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("quotes_mileage_upper_bound");
    expect(migration).toContain("mileage <= 9999999");
    expect(migration).toContain("quotes_notes_length_bound");
    expect(migration).toContain("char_length(notes) <= 4000");

    expect(migration).toContain("quote_services_category_length_bound");
    expect(migration).toContain("char_length(btrim(category)) between 1 and 80");
    expect(migration).toContain("quote_services_description_length_bound");
    expect(migration).toContain("char_length(btrim(description)) between 1 and 300");
    expect(migration).toContain("quote_services_labor_amount_upper_bound");
    expect(migration).toContain("labor_amount <= 1000000");

    expect(migration).toContain("quote_items_quantity_upper_bound");
    expect(migration).toContain("quantity <= 100000");
    expect(migration).toContain("quote_items_unit_length_bound");
    expect(migration).toContain("char_length(btrim(unit)) between 1 and 40");
    expect(migration).toContain("quote_items_side_length_bound");
    expect(migration).toContain("char_length(btrim(side)) <= 80");
    expect(migration).toContain("quote_items_specification_length_bound");
    expect(migration).toContain("char_length(btrim(specification)) <= 300");
    expect(migration).toContain("quote_items_notes_length_bound");
    expect(migration).toContain("char_length(btrim(notes)) <= 500");
  });

  test("usa NOT VALID para preservar dados históricos sem abrir novas escritas fora do limite", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const additions = migration.match(/add constraint/g) ?? [];
    const deferredValidation = migration.match(/\) not valid;/g) ?? [];

    expect(additions.length).toBe(12);
    expect(deferredValidation.length).toBe(12);
    expect(migration).not.toContain("delete from");
    expect(migration).not.toContain("truncate");
    expect(migration).not.toContain("drop table");
  });
});
