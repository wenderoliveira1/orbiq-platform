import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesQuoteListSearch, quotesListHref } from "../../apps/web/src/app/dashboard/orcamentos/quote-list-filter.ts";

const quote = {
  customerName: "João  Gonçalves",
  customerPhone: "+55 (11) 98765-4321",
  brand: "Citroën",
  model: "C3 Aircross",
  plate: "ABC-1D23",
  protocol: "ORB-2026-001",
};

for (const query of ["joao", "GONCALVES", " João   Gonçalves ", "citroen", "C3   Aircross", "11987654321", "(11) 98765-4321", "+55 11 98765 4321", "ABC1D23", "orb2026001", "", "   "]) {
  test(`finds quote for ${JSON.stringify(query)}`, () => {
    assert.equal(matchesQuoteListSearch(query, quote), true);
  });
}

for (const query of ["Maria", "21987654321", "João 11", "!!!", "XYZ9999", "orb2027001"]) {
  test(`does not match unrelated query ${JSON.stringify(query)}`, () => {
    assert.equal(matchesQuoteListSearch(query, quote), false);
  });
}

test("handles missing fields and preserves empty-query behavior", () => {
  assert.equal(matchesQuoteListSearch("joao", {}), false);
  assert.equal(matchesQuoteListSearch("11", { customerPhone: null }), false);
  assert.equal(matchesQuoteListSearch("", {}), true);
});

test("finds unformatted phone with formatted input", () => {
  assert.equal(matchesQuoteListSearch("(11) 98765-4321", { customerPhone: "11987654321" }), true);
});

test("links preserve original query and status", () => {
  const url = new URL(quotesListHref({ q: " João & Maria ", status: "estimating" }), "https://example.test");
  assert.equal(url.searchParams.get("q"), "João & Maria");
  assert.equal(url.searchParams.get("status"), "estimating");
  assert.equal(quotesListHref({}), "/dashboard/orcamentos");
});
