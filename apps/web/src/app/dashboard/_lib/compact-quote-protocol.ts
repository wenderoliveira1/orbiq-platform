/** ORB-260914-131120-5AA6 → ORB-260914-5AA6. Protocolos já curtos ficam iguais. */
export function compactQuoteProtocol(protocol: string | null | undefined): string {
  const raw = String(protocol ?? "").trim();
  if (!raw) return "";

  const long = raw.match(/^ORB-(\d{6})-\d{6}-([A-Z0-9]{4})$/i);
  if (long) {
    return `ORB-${long[1]}-${long[2].toUpperCase()}`;
  }

  return raw.toLocaleUpperCase("pt-BR");
}
