"use client";

import { useId, useState } from "react";

/**
 * Light guided chips for common workshop categories (MECÂNICA, ELÉTRICA, …).
 * Pattern: category chip → free description. No fake 2-step action/part catalog —
 * Funilaria keeps the rich structured picker.
 */
export const LIGHT_GUIDED_CATEGORIES = [
  "MECÂNICA",
  "ELÉTRICA",
  "SUSPENSÃO",
  "FREIOS",
  "DIREÇÃO",
  "MOTOR",
  "CÂMBIO",
  "ARREFECIMENTO",
  "AR-CONDICIONADO",
  "ALINHAMENTO",
  "OUTROS",
] as const;

export type CategoryGuidedConfirm = {
  category: string;
  description: string;
  laborAmount: string;
  needsPart: boolean;
  partDescription: string;
};

type Props = {
  onConfirm: (payload: CategoryGuidedConfirm) => void;
  /** Extra categories from org catalog (merged; FUNILARIA still excluded). */
  categories?: readonly string[];
  className?: string;
};

type Step = "category" | "describe";

function normalizeCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

/** Categories that already have a dedicated rich guided flow. */
const RICH_STRUCTURED = new Set(["FUNILARIA", "PINTURA"]);

export function CategoryGuidedPicker({
  onConfirm,
  categories,
  className = "",
}: Props) {
  const titleId = useId();
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [laborAmount, setLaborAmount] = useState("");
  const [needsPart, setNeedsPart] = useState(false);
  const [partDescription, setPartDescription] = useState("");
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chipCategories = (() => {
    const base: string[] = [...LIGHT_GUIDED_CATEGORIES];
    const extras = (categories ?? [])
      .map((item) => item.trim().toLocaleUpperCase("pt-BR"))
      .filter((item) => item && !RICH_STRUCTURED.has(normalizeCategory(item)));
    const seen = new Set(base.map((item) => normalizeCategory(item)));
    for (const extra of extras) {
      const key = normalizeCategory(extra);
      if (seen.has(key) || RICH_STRUCTURED.has(key)) continue;
      seen.add(key);
      base.push(extra);
    }
    return base.filter((item) => !RICH_STRUCTURED.has(normalizeCategory(item)));
  })();

  function pickCategory(next: string) {
    setCategory(next);
    setDescription("");
    setLaborAmount("");
    setNeedsPart(false);
    setPartDescription("");
    setError(null);
    setStep("describe");
  }

  function resetToCategories(keepFlash = false) {
    setStep("category");
    setCategory(null);
    setDescription("");
    setLaborAmount("");
    setNeedsPart(false);
    setPartDescription("");
    setError(null);
    if (!keepFlash) setLastAdded(null);
  }

  function confirm() {
    const text = description.trim();
    if (!category || text.length < 2) {
      setError("Informe a descrição do serviço antes de adicionar.");
      return;
    }
    const upperDescription = text.toLocaleUpperCase("pt-BR");
    onConfirm({
      category: category.toLocaleUpperCase("pt-BR"),
      description: upperDescription,
      laborAmount: laborAmount.trim(),
      needsPart,
      partDescription: needsPart
        ? (partDescription.trim().toLocaleUpperCase("pt-BR") || upperDescription)
        : "",
    });
    setLastAdded(`${category.toLocaleUpperCase("pt-BR")} · ${upperDescription}`);
    // Stay ready for next: back to category chips without losing parent quote context.
    resetToCategories(true);
  }

  return (
    <div
      className={`category-guided-picker ${className}`.trim()}
      data-testid="category-guided-picker"
      data-category-guided-step={step}
      role="region"
      aria-labelledby={titleId}
    >
      <div className="category-guided-head funilaria-guided-head">
        <div>
          <span className="orbiq-eyebrow" id={titleId}>
            OUTRAS ÁREAS
          </span>
          <strong>Categoria → descrição livre</strong>
          <small>
            Chips leves (MECÂNICA, ELÉTRICA…). Funilaria continua no fluxo estruturado abaixo.
          </small>
        </div>
        {step === "describe" ? (
          <button
            type="button"
            className="orbiq-secondary-button funilaria-back"
            data-testid="category-guided-back"
            onClick={() => resetToCategories(Boolean(lastAdded))}
          >
            Voltar
          </button>
        ) : null}
      </div>

      {lastAdded && step === "category" ? (
        <p
          className="quote-voice-added-banner"
          data-testid="category-guided-added-banner"
          role="status"
        >
          Adicionado: <strong>{lastAdded}</strong> — escolha a próxima área
        </p>
      ) : null}

      {step === "category" ? (
        <div className="funilaria-chip-grid category-guided-chip-grid" data-testid="category-guided-grid">
          {chipCategories.map((item) => (
            <button
              key={item}
              type="button"
              className="funilaria-chip category-guided-chip"
              data-testid={`category-guided-chip-${normalizeCategory(item).replace(/\s+/g, "-")}`}
              onClick={() => pickCategory(item)}
            >
              <strong>{item}</strong>
              <span>Descrever serviço</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === "describe" && category ? (
        <div className="category-guided-describe funilaria-confirm" data-testid="category-guided-describe">
          <div className="funilaria-preview">
            <span className="quote-voice-group-kicker">MÃO DE OBRA · {category}</span>
            <strong data-testid="category-guided-selected-category">{category}</strong>
            <small>Digite a descrição — sem catálogo estruturado inventado nesta área.</small>
          </div>
          <label className="quote-voice-field">
            <span>Descrição do serviço</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: TROCA DE CORREIA DENTADA"
              data-testid="category-guided-description"
              aria-label="Descrição do serviço da categoria"
              autoFocus
            />
          </label>
          <label className="quote-voice-field">
            <span>Mão de obra R$ unitária (opcional)</span>
            <input
              value={laborAmount}
              onChange={(event) => setLaborAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              data-testid="category-guided-labor"
              aria-label="Valor unitário da mão de obra"
            />
          </label>
          <label className="quote-voice-check">
            <input
              type="checkbox"
              checked={needsPart}
              onChange={(event) => {
                setNeedsPart(event.target.checked);
                if (!event.target.checked) setPartDescription("");
              }}
              data-testid="category-guided-needs-part"
            />
            <span>Inclui peça / item de compra (Peças)</span>
          </label>
          {needsPart ? (
            <label className="quote-voice-field">
              <span>Descrição da peça</span>
              <input
                value={partDescription}
                onChange={(event) => setPartDescription(event.target.value)}
                placeholder="Ex.: CORREIA DENTADA"
                data-testid="category-guided-part-description"
                aria-label="Descrição da peça"
              />
            </label>
          ) : null}
          {error ? (
            <p className="quote-voice-error" data-testid="category-guided-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="funilaria-confirm-actions">
            <button
              type="button"
              className="orbiq-secondary-button"
              onClick={() => resetToCategories(false)}
              data-testid="category-guided-discard"
            >
              Descartar
            </button>
            <button
              type="button"
              className="orbiq-primary-button"
              onClick={confirm}
              data-testid="category-guided-confirm-add"
            >
              Adicionar serviço
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
