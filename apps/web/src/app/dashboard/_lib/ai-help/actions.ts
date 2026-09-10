"use server";

import { getCurrentContext } from "../current-organization";
import { normalizeAiHelpQuestion } from "./faq";
import { hasOpenAiApiKeyConfigured, resolveAiHelpAnswer } from "./llm";
import { checkAiHelpRateLimit } from "./rate-limit";
import { sanitizeAiHelpAnswer } from "./sanitize";

export type AskAiHelpResult =
  | {
      ok: true;
      answer: string;
      source: "faq" | "llm" | "memory";
      cached: boolean;
      llmEnabled: boolean;
    }
  | {
      ok: false;
      error: string;
      retryAfterSeconds?: number;
    };

function isValidQuestion(question: string): boolean {
  const trimmed = question.trim();
  return trimmed.length >= 3 && trimmed.length <= 1000;
}

export async function askAiHelpAction(
  question: string,
): Promise<AskAiHelpResult> {
  if (!isValidQuestion(question)) {
    return {
      ok: false,
      error: "Digite uma pergunta objetiva (entre 3 e 1000 caracteres).",
    };
  }

  let context: Awaited<ReturnType<typeof getCurrentContext>>;

  try {
    context = await getCurrentContext();
  } catch {
    return {
      ok: false,
      error: "Sessão necessária. Entre novamente para usar a ajuda.",
    };
  }

  const { supabase, organization, user } = context;
  const rate = checkAiHelpRateLimit(`${organization.id}:${user.id}`);
  if (!rate.allowed) {
    return {
      ok: false,
      error:
        "Muitas perguntas em pouco tempo. Aguarde um momento e tente de novo.",
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  const normalized = normalizeAiHelpQuestion(question);
  const llmEnabled = hasOpenAiApiKeyConfigured();

  const { data: memoryRows, error: memoryError } = await supabase.rpc(
    "lookup_ai_help_memory",
    {
      target_org_id: organization.id,
      target_question_normalized: normalized,
    },
  );

  if (!memoryError && memoryRows?.[0]?.answer_text) {
    const row = memoryRows[0];
    return {
      ok: true,
      answer: sanitizeAiHelpAnswer(String(row.answer_text)),
      source: "memory",
      cached: true,
      llmEnabled,
    };
  }

  const resolved = await resolveAiHelpAnswer(question.trim());

  void supabase.rpc("remember_ai_help_memory", {
    target_org_id: organization.id,
    target_question_normalized: normalized,
    target_question_text: question.trim().slice(0, 1000),
    target_answer_text: resolved.answer.slice(0, 8000),
    target_source: resolved.source,
  });

  return {
    ok: true,
    answer: resolved.answer,
    source: resolved.source,
    cached: false,
    llmEnabled,
  };
}
