const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bservice[_\s-]?role\b/i,
  /\bsb_secret_/i,
  /\bOPENAI_API_KEY\b/i,
  /\bSUPABASE_SERVICE\b/i,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
];

/**
 * Remove vazamentos óbvios de segredo e reforça que a resposta
 * não deve detalhar custo/lucro de compra em tom de folha de cliente.
 * O assistente vive só no dashboard autenticado; ainda assim
 * evitamos copiar números sensíveis vindos do modelo.
 */
export function sanitizeAiHelpAnswer(answer: string): string {
  let cleaned = answer.trim();

  for (const pattern of FORBIDDEN_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[redigido]");
  }

  if (cleaned.length > 8000) {
    cleaned = `${cleaned.slice(0, 7990)}…`;
  }

  return cleaned;
}

export function answerLooksSensitiveForClientLeak(answer: string): boolean {
  return (
    /\bcusto de compra\b/i.test(answer) ||
    /\bpreço de compra\b/i.test(answer) ||
    /\blucro\s*[:=]?\s*\d/i.test(answer) ||
    /\bmargem\s*[:=]?\s*\d+\s*%/i.test(answer) ||
    /\bparts_cost\b/i.test(answer)
  );
}

export function staffSafetyFooter(): string {
  return "\n\n_Lembrete: custo de compra e lucro são internos da oficina — não use na folha/link do cliente._";
}
