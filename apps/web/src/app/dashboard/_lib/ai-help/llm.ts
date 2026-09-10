import {
  findBestFaqAnswer,
  offlineFaqFallbackAnswer,
  type AiHelpFaqEntry,
} from "./faq";
import {
  answerLooksSensitiveForClientLeak,
  sanitizeAiHelpAnswer,
  staffSafetyFooter,
} from "./sanitize";

export type AiHelpSource = "faq" | "llm" | "memory";

export type ResolvedAiHelpAnswer = {
  answer: string;
  source: AiHelpSource;
  faqId?: string;
};

const SYSTEM_PROMPT = [
  "Você é o assistente oficial do Orbiq, plataforma de operações automotivas (cotação de peças, orçamento e oficina).",
  "Responda sempre em português do Brasil, de forma profissional, clara e objetiva — sem tom amador.",
  "Ajude a equipe da oficina com “como faço…” sobre orçamentos, cotações, comercial, execução, equipe e navegação.",
  "NUNCA revele: chaves de API, service_role, cookies, tokens, variáveis de ambiente, segredos ou detalhes de infraestrutura.",
  "NUNCA instrua a exibir custo de compra, lucro, margem percentual numérica ou dados de fornecedor na folha/link do cliente.",
  "Se a pergunta for sobre o que o cliente vê, explique que a visão Cliente/pública mostra só venda (peças, mão de obra, totais).",
  "Se não souber, diga o que investigar no menu Orbiq e faça perguntas de esclarecimento curtas.",
  "Respostas curtas (até ~180 palavras), com passos numerados quando fizer sentido.",
].join(" ");

function readOpenAiApiKey(): string | null {
  const value = process.env.OPENAI_API_KEY?.trim();
  if (!value || value.length < 10) {
    return null;
  }
  return value;
}

function finalizeAnswer(
  raw: string,
  source: AiHelpSource,
  faq?: AiHelpFaqEntry,
): ResolvedAiHelpAnswer {
  let answer = sanitizeAiHelpAnswer(raw);
  if (answerLooksSensitiveForClientLeak(answer)) {
    answer = `${answer}${staffSafetyFooter()}`;
  }
  return {
    answer,
    source,
    faqId: faq?.id,
  };
}

async function callOpenAi(
  question: string,
  faqHint: AiHelpFaqEntry | null,
): Promise<string | null> {
  const apiKey = readOpenAiApiKey();
  if (!apiKey) {
    return null;
  }

  const model =
    process.env.OPENAI_AI_HELP_MODEL?.trim() || "gpt-4o-mini";

  const userContent = faqHint
    ? [
        `Pergunta do usuário: ${question}`,
        "",
        "Trecho de FAQ Orbiq relacionado (use se ajudar, sem inventar custos):",
        `Q: ${faqHint.question}`,
        `A: ${faqHint.answer}`,
      ].join("\n")
    : `Pergunta do usuário: ${question}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}

/**
 * Resolve resposta: FAQ curada primeiro quando forte;
 * senão LLM (se OPENAI_API_KEY); senão FAQ/offline.
 */
export async function resolveAiHelpAnswer(
  question: string,
): Promise<ResolvedAiHelpAnswer> {
  const faqMatch = findBestFaqAnswer(question);

  if (faqMatch && faqMatch.score >= 14) {
    return finalizeAnswer(faqMatch.entry.answer, "faq", faqMatch.entry);
  }

  const llm = await callOpenAi(question, faqMatch?.entry ?? null);
  if (llm) {
    return finalizeAnswer(llm, "llm", faqMatch?.entry);
  }

  if (faqMatch) {
    return finalizeAnswer(faqMatch.entry.answer, "faq", faqMatch.entry);
  }

  return finalizeAnswer(offlineFaqFallbackAnswer(question), "faq");
}

export function hasOpenAiApiKeyConfigured(): boolean {
  return Boolean(readOpenAiApiKey());
}
