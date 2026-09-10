"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  parseVoiceTranscript,
  VOICE_SERVICE_CATEGORIES,
  type ParsedVoiceService,
} from "./quote-voice-parse";

export type QuoteVoiceConfirmPayload = ParsedVoiceService & {
  transcript: string;
};

type Props = {
  /** Called only after the human clicks Confirmar — never on raw speech end. */
  onConfirm: (payload: QuoteVoiceConfirmPayload) => void;
  categories?: readonly string[];
  className?: string;
  dense?: boolean;
};

type Phase = "idle" | "listening" | "review" | "unsupported";

const emptyFields = (): ParsedVoiceService => ({
  category: "MECÂNICA",
  description: "",
  laborAmount: "",
  needsPart: false,
  partDescription: "",
});

export function QuoteVoiceCapture({
  onConfirm,
  categories = VOICE_SERVICE_CATEGORIES,
  className = "",
  dense = false,
}: Props) {
  const titleId = useId();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalChunkRef = useRef("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [supported, setSupported] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ParsedVoiceService>(emptyFields);

  useEffect(() => {
    let cancelled = false;
    // Defer support probe (react-hooks/set-state-in-effect) — Web Speech exists only in the browser.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const ok = isSpeechRecognitionSupported();
      setSupported(ok);
      if (!ok) setPhase("unsupported");
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const openReview = useCallback(
    (finalText: string) => {
      const text = finalText.trim();
      if (!text) {
        setError("Não capturamos áudio. Tente de novo.");
        setPhase("idle");
        return;
      }
      const parsed = parseVoiceTranscript(text);
      const matched =
        categories.find(
          (item) =>
            item.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleUpperCase("pt-BR") ===
            parsed.category.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleUpperCase("pt-BR"),
        ) ?? parsed.category;
      setTranscript(text);
      setFields({ ...parsed, category: matched });
      setInterim("");
      setError(null);
      setPhase("review");
    },
    [categories],
  );

  const startListening = useCallback(() => {
    setError(null);
    setInterim("");
    setTranscript("");
    finalChunkRef.current = "";
    const recognition = createSpeechRecognition();
    if (!recognition) {
      setSupported(false);
      setPhase("unsupported");
      return;
    }
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += piece;
        else interimText += piece;
      }
      if (finalText) {
        finalChunkRef.current = `${finalChunkRef.current} ${finalText}`.trim();
        setTranscript(finalChunkRef.current);
      }
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      const code = event.error;
      if (code === "aborted") return;
      if (code === "not-allowed") {
        setError("Microfone bloqueado. Permita o microfone no navegador.");
      } else if (code === "no-speech") {
        setError("Nenhuma fala detectada. Segure o mic e fale o serviço.");
      } else {
        setError("Falha na captura de voz. Tente novamente.");
      }
      setPhase("idle");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const text = (finalChunkRef.current || "").trim();
      if (text) {
        openReview(text);
        return;
      }
      setPhase((current) => (current === "listening" ? "idle" : current));
    };

    try {
      recognition.start();
      setPhase("listening");
    } catch {
      setError("Não foi possível iniciar o microfone.");
      setPhase("idle");
    }
  }, [openReview]);

  function discard() {
    stopListening();
    setTranscript("");
    setInterim("");
    setFields(emptyFields());
    setError(null);
    setPhase(supported ? "idle" : "unsupported");
  }

  function confirm() {
    const description = fields.description.trim();
    if (description.length < 2) {
      setError("Revise a descrição do serviço antes de confirmar.");
      return;
    }
    // Human gate: only Confirmar calls onConfirm — never auto-save on speech end.
    onConfirm({
      ...fields,
      description: description.toLocaleUpperCase("pt-BR"),
      partDescription: fields.needsPart
        ? fields.partDescription.trim().toLocaleUpperCase("pt-BR")
        : "",
      transcript: transcript.trim(),
    });
    discard();
  }

  if (phase === "unsupported") {
    return (
      <div
        className={`quote-voice-capture is-unsupported${dense ? " is-dense" : ""} ${className}`.trim()}
        data-testid="quote-voice-capture"
        data-voice-supported="false"
        role="region"
        aria-labelledby={titleId}
      >
        <div className="quote-voice-capture-head">
          <span className="orbiq-eyebrow" id={titleId}>
            VOZ (PT-BR)
          </span>
          <strong>Microfone indisponível neste navegador</strong>
        </div>
        <p className="quote-voice-fallback" data-testid="quote-voice-unsupported">
          Use Chrome ou Edge (localhost/HTTPS) para falar o serviço com as mãos ocupadas. Safari e
          Firefox ainda não suportam a Web Speech API aqui.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`quote-voice-capture${phase === "listening" ? " is-listening" : ""}${
        phase === "review" ? " is-review" : ""
      }${dense ? " is-dense" : ""} ${className}`.trim()}
      data-testid="quote-voice-capture"
      data-voice-supported="true"
      data-voice-phase={phase}
      role="region"
      aria-labelledby={titleId}
    >
      <div className="quote-voice-capture-head">
        <div>
          <span className="orbiq-eyebrow" id={titleId}>
            VOZ (PT-BR)
          </span>
          <strong>Falar serviço com as mãos ocupadas</strong>
          <small>Captura → revisa → Confirmar. Nada é salvo só por falar.</small>
        </div>
        {phase !== "review" ? (
          <button
            type="button"
            className={`quote-voice-mic${phase === "listening" ? " is-active" : ""}`}
            data-testid="quote-voice-mic"
            aria-pressed={phase === "listening"}
            aria-label={phase === "listening" ? "Parar de ouvir" : "Iniciar captura de voz"}
            onClick={() => {
              if (phase === "listening") stopListening();
              else startListening();
            }}
          >
            <span className="quote-voice-mic-icon" aria-hidden>
              {phase === "listening" ? "■" : "🎤"}
            </span>
            <span className="quote-voice-mic-label">
              {phase === "listening" ? "Ouvindo… toque para parar" : "Falar serviço"}
            </span>
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="quote-voice-error" data-testid="quote-voice-error" role="alert">
          {error}
        </p>
      ) : null}

      {phase === "listening" ? (
        <p className="quote-voice-live" data-testid="quote-voice-live" aria-live="polite">
          {interim || transcript || "Fale o serviço, ex.: alinhar para-lama esquerdo…"}
        </p>
      ) : null}

      {phase === "review" ? (
        <div className="quote-voice-review" data-testid="quote-voice-review">
          <label className="quote-voice-field quote-voice-transcript">
            <span>Texto transcrito</span>
            <textarea
              value={transcript}
              onChange={(event) => {
                const next = event.target.value;
                setTranscript(next);
                setFields(parseVoiceTranscript(next));
              }}
              rows={2}
              data-testid="quote-voice-transcript"
              aria-label="Texto transcrito"
            />
          </label>

          <div className="quote-voice-fields">
            <div className="quote-voice-group" data-testid="quote-voice-labor-group">
              <span className="quote-voice-group-kicker">MÃO DE OBRA</span>
              <label className="quote-voice-field">
                <span>Categoria</span>
                <select
                  value={fields.category}
                  onChange={(event) => setFields((current) => ({ ...current, category: event.target.value }))}
                  data-testid="quote-voice-category"
                  aria-label="Categoria do serviço"
                >
                  {Array.from(new Set([...categories, fields.category])).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="quote-voice-field">
                <span>Descrição do serviço</span>
                <input
                  value={fields.description}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, description: event.target.value }))
                  }
                  data-testid="quote-voice-description"
                  aria-label="Descrição do serviço"
                  placeholder="Ex.: ALINHAR — PARA-LAMA ESQUERDO"
                />
              </label>
              <label className="quote-voice-field">
                <span>Mão de obra R$ unitária</span>
                <input
                  value={fields.laborAmount}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, laborAmount: event.target.value }))
                  }
                  inputMode="decimal"
                  data-testid="quote-voice-labor"
                  aria-label="Valor unitário da mão de obra"
                  placeholder="0,00"
                />
              </label>
            </div>

            <div className="quote-voice-group" data-testid="quote-voice-parts-group">
              <span className="quote-voice-group-kicker">PEÇAS</span>
              <label className="quote-voice-check">
                <input
                  type="checkbox"
                  checked={fields.needsPart}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      needsPart: event.target.checked,
                      partDescription: event.target.checked ? current.partDescription : "",
                    }))
                  }
                  data-testid="quote-voice-needs-part"
                />
                <span>Inclui peça / item de compra</span>
              </label>
              {fields.needsPart ? (
                <label className="quote-voice-field">
                  <span>Descrição da peça</span>
                  <input
                    value={fields.partDescription}
                    onChange={(event) =>
                      setFields((current) => ({ ...current, partDescription: event.target.value }))
                    }
                    data-testid="quote-voice-part-description"
                    aria-label="Descrição da peça"
                    placeholder="Ex.: PARA-LAMA ESQUERDO"
                  />
                </label>
              ) : (
                <p className="quote-voice-parts-hint">Sem peça — só mão de obra neste lançamento.</p>
              )}
            </div>
          </div>

          <div className="quote-voice-actions">
            <button
              type="button"
              className="orbiq-secondary-button"
              data-testid="quote-voice-discard"
              onClick={discard}
            >
              Descartar
            </button>
            <button
              type="button"
              className="orbiq-primary-button"
              data-testid="quote-voice-confirm"
              onClick={confirm}
            >
              Confirmar e adicionar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
