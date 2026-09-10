import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  findBestFaqAnswer,
  normalizeAiHelpQuestion,
  offlineFaqFallbackAnswer,
} from "../../apps/web/src/app/dashboard/_lib/ai-help/faq";
import { AI_HELP_RATE_LIMIT } from "../../apps/web/src/app/dashboard/_lib/ai-help/rate-limit";
import {
  answerLooksSensitiveForClientLeak,
  sanitizeAiHelpAnswer,
} from "../../apps/web/src/app/dashboard/_lib/ai-help/sanitize";

const CLIENT_SURFACES = [
  "apps/web/src/app/dashboard/comercial/[quoteId]/cliente/page.tsx",
  "apps/web/src/app/orcamento/[token]/page.tsx",
] as const;

test.describe("Fase 2.1BH — assistente de ajuda in-app", () => {
  test("shell do dashboard monta FAB/painel; folha pública do cliente não", async () => {
    const layout = await readFile(
      "apps/web/src/app/dashboard/layout.tsx",
      "utf8",
    );
    const assistant = await readFile(
      "apps/web/src/app/dashboard/_components/ai-help/ai-help-assistant.tsx",
      "utf8",
    );
    const css = await readFile(
      "apps/web/src/app/dashboard/dashboard.css",
      "utf8",
    );

    expect(layout).toContain("AiHelpAssistant");
    expect(assistant).toContain('data-testid="orbiq-ai-help"');
    expect(assistant).toContain('data-testid="orbiq-ai-help-fab"');
    expect(assistant).toContain('data-testid="orbiq-ai-help-panel"');
    expect(assistant).toContain("askAiHelpAction");
    expect(assistant).toContain("Assistente da oficina");
    expect(css).toContain(".orbiq-ai-help-fab");
    expect(css).toContain("@media print");
    expect(css).toMatch(/\.orbiq-ai-help\s*\{[^}]*display:\s*none\s*!important/s);

    for (const relativePath of CLIENT_SURFACES) {
      const source = await readFile(relativePath, "utf8");
      expect(source).not.toContain("AiHelpAssistant");
      expect(source).not.toContain("orbiq-ai-help-fab");
    }
  });

  test("API/ação autenticada, FAQ offline e memória org-scoped com RLS", async () => {
    const actions = await readFile(
      "apps/web/src/app/dashboard/_lib/ai-help/actions.ts",
      "utf8",
    );
    const route = await readFile(
      "apps/web/src/app/api/ai-help/route.ts",
      "utf8",
    );
    const llm = await readFile(
      "apps/web/src/app/dashboard/_lib/ai-help/llm.ts",
      "utf8",
    );
    const migration = await readFile(
      "supabase/migrations/20260910220000_orbiq_ai_help_memory.sql",
      "utf8",
    );
    const envExample = await readFile("apps/web/environment.example", "utf8");

    expect(actions).toContain("getCurrentContext");
    expect(actions).toContain("checkAiHelpRateLimit");
    expect(actions).toContain("lookup_ai_help_memory");
    expect(actions).toContain("remember_ai_help_memory");
    expect(actions).not.toContain("service_role");
    expect(actions).not.toContain("SERVICE_ROLE");

    expect(route).toContain("auth.getUser");
    expect(route).toContain("status: 401");
    expect(route).toContain("askAiHelpAction");
    expect(route).not.toContain("service_role");

    expect(llm).toContain("OPENAI_API_KEY");
    expect(llm).toContain("offlineFaqFallbackAnswer");
    expect(llm).toContain("NUNCA revele");
    expect(llm).not.toContain("NEXT_PUBLIC_OPENAI");

    expect(migration).toContain("public.ai_help_memories");
    expect(migration).toContain("create table if not exists");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("ai_help_memories_select_member");
    expect(migration).toContain("public.is_org_member(organization_id)");
    expect(migration).toContain("lookup_ai_help_memory");
    expect(migration).toContain("remember_ai_help_memory");
    expect(migration).toContain("security definer");
    expect(migration).toContain("revoke all");
    expect(migration).toContain("grant execute");

    expect(envExample).toContain("OPENAI_API_KEY");
    expect(envExample).toContain("somente servidor");
    expect(envExample).not.toMatch(/NEXT_PUBLIC_OPENAI/);
  });

  test("FAQ, rate limit e sanitização de segredos/custo", async () => {
    expect(normalizeAiHelpQuestion("  Como criar ORÇAMENTO? ")).toBe(
      "como criar orcamento",
    );

    const match = findBestFaqAnswer("como criar um novo orçamento?");
    expect(match).not.toBeNull();
    expect(match?.entry.id).toBe("novo-orcamento");
    expect(match!.entry.answer.toLowerCase()).not.toMatch(/\blucro\b/);
    expect(match!.entry.answer.toLowerCase()).not.toMatch(/\bcusto de compra\b/);

    const offline = offlineFaqFallbackAnswer("xyzzy foobar desconhecido 123");
    expect(offline).toContain("modo offline");
    expect(offline).toContain("OPENAI_API_KEY");

    expect(AI_HELP_RATE_LIMIT.maxRequests).toBeGreaterThanOrEqual(5);
    expect(AI_HELP_RATE_LIMIT.windowMs).toBe(60_000);

    expect(sanitizeAiHelpAnswer("use service_role agora")).toContain(
      "[redigido]",
    );
    expect(
      answerLooksSensitiveForClientLeak("O lucro = 35 no pedido"),
    ).toBe(true);
  });

  test("rota ai-help exige autenticação", async ({ request }) => {
    const response = await request.post("/api/ai-help", {
      data: { question: "Como criar orçamento?" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });
});
