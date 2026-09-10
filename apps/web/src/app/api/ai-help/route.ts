import { NextResponse } from "next/server";

import { askAiHelpAction } from "@/app/dashboard/_lib/ai-help/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AiHelpBody = {
  question?: unknown;
};

/**
 * Rota autenticada do assistente in-app.
 * Não expõe service_role; usa a sessão do usuário + RLS/RPC.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      {
        status: 401,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  let body: AiHelpBody;
  try {
    body = (await request.json()) as AiHelpBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      {
        status: 400,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  const question = typeof body.question === "string" ? body.question : "";
  const result = await askAiHelpAction(question);

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.retryAfterSeconds ? 429 : 400,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST com { question }." },
    {
      status: 405,
      headers: {
        Allow: "POST",
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
