"use client";

import { useId, useMemo, useState } from "react";

import {
  composeFunilariaDescription,
  FUNILARIA_ACTIONS,
  FUNILARIA_CATEGORY,
  FUNILARIA_PARTS,
  type FunilariaAction,
  type FunilariaPart,
} from "./funilaria-catalog";

export type FunilariaPickerConfirm = {
  category: typeof FUNILARIA_CATEGORY;
  description: string;
  actionId: string;
  partId: string;
  laborAmount: string;
  needsPartHint: boolean;
  partDescription: string;
};

type Props = {
  onConfirm: (payload: FunilariaPickerConfirm) => void;
  className?: string;
};

type Step = "action" | "part" | "confirm";

export function FunilariaGuidedPicker({ onConfirm, className = "" }: Props) {
  const titleId = useId();
  const [step, setStep] = useState<Step>("action");
  const [action, setAction] = useState<FunilariaAction | null>(null);
  const [part, setPart] = useState<FunilariaPart | null>(null);
  const [laborAmount, setLaborAmount] = useState("");
  const [needsPart, setNeedsPart] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const description = useMemo(() => {
    if (!action || !part) return "";
    return composeFunilariaDescription(action.verb, part.phrase);
  }, [action, part]);

  function pickAction(next: FunilariaAction) {
    setAction(next);
    setPart(null);
    setNeedsPart(next.id === "trocar");
    setLastAdded(null);
    setStep("part");
  }

  function pickPart(next: FunilariaPart) {
    setPart(next);
    setStep("confirm");
  }

  function reset(keepFlash = false) {
    setStep("action");
    setAction(null);
    setPart(null);
    setLaborAmount("");
    setNeedsPart(false);
    if (!keepFlash) setLastAdded(null);
  }

  function confirm() {
    if (!action || !part || description.length < 2) return;
    onConfirm({
      category: FUNILARIA_CATEGORY,
      description,
      actionId: action.id,
      partId: part.id,
      laborAmount: laborAmount.trim(),
      needsPartHint: needsPart,
      partDescription: needsPart ? part.phrase : "",
    });
    setLastAdded(description);
    // Stay ready for next Funilaria service in the same quote session.
    reset(true);
  }

  return (
    <div
      className={`funilaria-guided-picker ${className}`.trim()}
      data-testid="funilaria-guided-picker"
      data-funilaria-step={step}
      role="region"
      aria-labelledby={titleId}
    >
      <div className="funilaria-guided-head">
        <div>
          <span className="orbiq-eyebrow" id={titleId}>
            FUNILARIA GUIADA
          </span>
          <strong>2 passos: ação → peça/lado</strong>
          <small>Caminho principal · chips grandes. Após adicionar: diga/toque o próximo.</small>
        </div>
        {step !== "action" ? (
          <button
            type="button"
            className="orbiq-secondary-button funilaria-back"
            data-testid="funilaria-back"
            onClick={() => {
              if (step === "confirm") {
                setStep("part");
                return;
              }
              reset(Boolean(lastAdded));
            }}
          >
            Voltar
          </button>
        ) : null}
      </div>

      {lastAdded && step === "action" ? (
        <p
          className="quote-voice-added-banner"
          data-testid="funilaria-added-banner"
          role="status"
        >
          Adicionado: <strong>{lastAdded}</strong> — diga/toque o próximo
        </p>
      ) : null}

      {step === "action" ? (
        <div className="funilaria-chip-grid" data-testid="funilaria-action-grid">
          {FUNILARIA_ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="funilaria-chip"
              data-testid={`funilaria-action-${item.id}`}
              onClick={() => pickAction(item)}
            >
              <strong>{item.label}</strong>
              <span>{item.verb}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === "part" && action ? (
        <>
          <p className="funilaria-step-hint" data-testid="funilaria-selected-action">
            Ação: <strong>{action.label}</strong> — agora escolha a peça / lado
          </p>
          <div className="funilaria-chip-grid is-parts" data-testid="funilaria-part-grid">
            {FUNILARIA_PARTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="funilaria-chip is-part"
                data-testid={`funilaria-part-${item.id}`}
                onClick={() => pickPart(item)}
              >
                <strong>{item.label}</strong>
                <span>{item.phrase}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === "confirm" && action && part ? (
        <div className="funilaria-confirm" data-testid="funilaria-confirm-panel">
          <div className="funilaria-preview">
            <span className="quote-voice-group-kicker">MÃO DE OBRA · FUNILARIA</span>
            <strong data-testid="funilaria-composed-description">{description}</strong>
            {needsPart ? (
              <small data-testid="funilaria-parts-preview">Peças: {part.phrase}</small>
            ) : (
              <small>Só mão de obra — sem peça neste lançamento</small>
            )}
          </div>
          <label className="quote-voice-field">
            <span>Mão de obra R$ unitária (opcional)</span>
            <input
              value={laborAmount}
              onChange={(event) => setLaborAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              data-testid="funilaria-labor"
              aria-label="Valor unitário da mão de obra funilaria"
            />
          </label>
          <label className="quote-voice-check">
            <input
              type="checkbox"
              checked={needsPart}
              onChange={(event) => setNeedsPart(event.target.checked)}
              data-testid="funilaria-needs-part"
            />
            <span>Inclui peça / item de compra (Peças)</span>
          </label>
          <div className="funilaria-confirm-actions">
            <button type="button" className="orbiq-secondary-button" onClick={() => reset(false)} data-testid="funilaria-discard">
              Descartar
            </button>
            <button
              type="button"
              className="orbiq-primary-button"
              onClick={confirm}
              data-testid="funilaria-confirm-add"
            >
              Adicionar serviço
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
