/** Dense client-side matching for the orçamentos history list (PT-BR). */

export function compactSearchToken(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/gi, "");
}

export function normalizeListQuery(raw: string): string {
  return raw.trim().toLocaleLowerCase("pt-BR");
}

export type QuoteListSearchFields = {
  protocol?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
};

/**
 * Match by customer name, phone, plate (hyphen-tolerant), protocol (ORB-…),
 * and brand/model. Empty query matches everything.
 */
export function matchesQuoteListSearch(
  query: string,
  fields: QuoteListSearchFields,
): boolean {
  const q = normalizeListQuery(query);
  if (!q) {
    return true;
  }

  const qCompact = compactSearchToken(q);

  const haystacks = [
    fields.protocol,
    fields.customerName,
    fields.customerPhone,
    fields.plate,
    fields.brand,
    fields.model,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLocaleLowerCase("pt-BR"));

  if (haystacks.some((value) => value.includes(q))) {
    return true;
  }

  if (!qCompact) {
    return false;
  }

  const plateCompact = compactSearchToken(fields.plate ?? "");
  const protocolCompact = compactSearchToken(fields.protocol ?? "");

  return (
    (plateCompact.length > 0 && plateCompact.includes(qCompact)) ||
    (protocolCompact.length > 0 && protocolCompact.includes(qCompact))
  );
}

export function quotesListHref(options: {
  q?: string | null;
  status?: string | null;
}): string {
  const params = new URLSearchParams();
  const q = String(options.q ?? "").trim();
  const status = String(options.status ?? "").trim();

  if (q) {
    params.set("q", q);
  }

  if (status) {
    params.set("status", status);
  }

  const query = params.toString();
  return query
    ? `/dashboard/orcamentos?${query}`
    : "/dashboard/orcamentos";
}
