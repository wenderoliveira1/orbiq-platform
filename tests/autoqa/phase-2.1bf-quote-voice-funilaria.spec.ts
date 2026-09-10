import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  composeFunilariaDescription,
  matchFunilariaFromTranscript,
} from "../../apps/web/src/app/dashboard/orcamentos/_components/funilaria-catalog";
import { parseVoiceTranscript } from "../../apps/web/src/app/dashboard/orcamentos/_components/quote-voice-parse";

test.describe("Fase 2.1BF — voz no orçamento + Funilaria guiada", () => {
  test("componente de voz: mic, pt-BR, review e sem save cego", async () => {
    const capture = await readFile(
      "apps/web/src/app/dashboard/orcamentos/_components/quote-voice-capture.tsx",
      "utf8",
    );
    const parse = await readFile(
      "apps/web/src/app/dashboard/orcamentos/_components/quote-voice-parse.ts",
      "utf8",
    );

    expect(capture).toContain('data-testid="quote-voice-capture"');
    expect(capture).toContain('data-testid="quote-voice-mic"');
    expect(capture).toContain('data-testid="quote-voice-review"');
    expect(capture).toContain('data-testid="quote-voice-confirm"');
    expect(capture).toContain('data-testid="quote-voice-discard"');
    expect(capture).toContain('data-testid="quote-voice-labor-group"');
    expect(capture).toContain('data-testid="quote-voice-parts-group"');
    expect(capture).toContain("MÃO DE OBRA");
    expect(capture).toContain("PEÇAS");
    expect(capture).toContain("Confirmar e adicionar");
    expect(capture).toContain("Descartar");
    expect(capture).toContain("VOZ (PT-BR)");
    expect(capture).toContain("Nada é salvo só por falar");
    expect(capture).toContain("quote-voice-unsupported");

    // Human gate: speech end opens review only; onConfirm is reserved for confirm()
    expect(capture).toContain("openReview(text)");
    expect(capture).toContain("function confirm()");
    expect(capture).toContain("onConfirm({");
    expect(capture).toContain("Nada é salvo só por falar");
    const onEndIdx = capture.indexOf("recognition.onend");
    const confirmFnIdx = capture.indexOf("function confirm()");
    expect(onEndIdx).toBeGreaterThan(-1);
    expect(confirmFnIdx).toBeGreaterThan(onEndIdx);
    const onEndBlock = capture.slice(onEndIdx, confirmFnIdx);
    expect(onEndBlock).not.toContain("onConfirm(");

    expect(parse).toContain('recognition.lang = "pt-BR"');
    expect(parse).toContain("webkitSpeechRecognition");
    expect(parse).toContain("parseVoiceTranscript");
    expect(parse).toContain("matchFunilariaFromTranscript");
  });

  test("Funilaria guiada: ação → peça/lado e descrição composta", async () => {
    const picker = await readFile(
      "apps/web/src/app/dashboard/orcamentos/_components/funilaria-guided-picker.tsx",
      "utf8",
    );
    const catalog = await readFile(
      "apps/web/src/app/dashboard/orcamentos/_components/funilaria-catalog.ts",
      "utf8",
    );

    expect(picker).toContain('data-testid="funilaria-guided-picker"');
    expect(picker).toContain('data-testid="funilaria-action-grid"');
    expect(picker).toContain('data-testid="funilaria-part-grid"');
    expect(picker).toContain('data-testid="funilaria-confirm-add"');
    expect(picker).toContain("FUNILARIA GUIADA");
    expect(picker).toContain("2 passos: ação → peça/lado");
    expect(catalog).toContain('verb: "ALINHAR"');
    expect(catalog).toContain('phrase: "PARA-LAMA ESQUERDO"');
    expect(catalog).toContain("composeFunilariaDescription");

    expect(composeFunilariaDescription("ALINHAR", "PARA-LAMA ESQUERDO")).toBe(
      "ALINHAR — PARA-LAMA ESQUERDO",
    );

    const matched = matchFunilariaFromTranscript("alinhar para-lama esquerdo");
    expect(matched.description).toBe("ALINHAR — PARA-LAMA ESQUERDO");
    expect(matched.action?.id).toBe("alinhar");
    expect(matched.part?.id).toBe("paralama-e");
  });

  test("parse de voz pré-preenche Funilaria sem auto-peça em alinhar", async () => {
    const parsed = parseVoiceTranscript("alinhar para-lama esquerdo");
    expect(parsed.category).toBe("FUNILARIA");
    expect(parsed.description).toBe("ALINHAR — PARA-LAMA ESQUERDO");
    expect(parsed.needsPart).toBe(false);

    const trocar = parseVoiceTranscript("trocar para-lama direito");
    expect(trocar.category).toBe("FUNILARIA");
    expect(trocar.description).toBe("TROCAR — PARA-LAMA DIREITO");
    expect(trocar.needsPart).toBe(true);
    expect(trocar.partDescription).toBe("PARA-LAMA DIREITO");

    const withLabor = parseVoiceTranscript("mão de obra pintura 800");
    expect(withLabor.laborAmount).toMatch(/800/);
  });

  test("Novo Orçamento e detalhe desbloqueado conectam voz + funilaria", async () => {
    const builder = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-builder.tsx",
      "utf8",
    );
    const detail = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );
    const append = await readFile(
      "apps/web/src/app/dashboard/orcamentos/_components/quote-append-with-voice.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(builder).toContain("QuoteVoiceCapture");
    expect(builder).toContain("FunilariaGuidedPicker");
    expect(builder).toContain("addVoiceOrGuidedService");
    expect(builder).toContain("onVoiceConfirm");

    expect(detail).toContain("QuoteAppendWithVoice");
    expect(detail).not.toMatch(/!locked \? \(\s*<div className="no-print quote-append-panel">\s*<form action=\{addQuoteServiceAction\}/);

    expect(append).toContain("QuoteVoiceCapture");
    expect(append).toContain("FunilariaGuidedPicker");
    expect(append).toContain("onVoiceConfirm");
    expect(append).toContain("requestSubmit");
    expect(append).toContain("Human already confirmed");

    expect(css).toContain(".quote-voice-mic");
    expect(css).toContain(".funilaria-chip");
    expect(css).toContain(".quote-voice-group-kicker");
    expect(css).toContain("min-height: 52px");
    expect(css).toContain("min-height: 64px");
  });
});
