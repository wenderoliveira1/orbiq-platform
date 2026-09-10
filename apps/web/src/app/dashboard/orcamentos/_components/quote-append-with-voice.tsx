"use client";

import { useRef } from "react";

import { CategoryGuidedPicker } from "./category-guided-picker";
import { FunilariaGuidedPicker } from "./funilaria-guided-picker";
import { QuoteVoiceCapture, type QuoteVoiceConfirmPayload } from "./quote-voice-capture";

type CatalogItem = {
  id: string;
  category: string;
  description: string;
};

type Props = {
  quoteId: string;
  serviceCatalog: CatalogItem[];
  addAction: (formData: FormData) => void | Promise<void>;
};

/**
 * Unlocked quote detail: append service form + voice confirm + Funilaria guided chips.
 * Voice / guided paths fill fields then submit only after explicit human confirm.
 */
export function QuoteAppendWithVoice({ quoteId, serviceCatalog, addAction }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const laborRef = useRef<HTMLInputElement>(null);
  const needsPartRef = useRef<HTMLInputElement>(null);

  function applyPayload(payload: {
    category: string;
    description: string;
    laborAmount?: string;
    needsPart?: boolean;
  }) {
    if (categoryRef.current) categoryRef.current.value = payload.category;
    if (descriptionRef.current) descriptionRef.current.value = payload.description;
    if (laborRef.current && payload.laborAmount) {
      const normalized = payload.laborAmount.replace(",", ".");
      laborRef.current.value = normalized;
    }
    if (needsPartRef.current) needsPartRef.current.checked = Boolean(payload.needsPart);
  }

  function submitAfterConfirm(payload: {
    category: string;
    description: string;
    laborAmount?: string;
    needsPart?: boolean;
  }) {
    applyPayload(payload);
    // Human already confirmed in voice/funilaria UI — safe to submit the form once.
    formRef.current?.requestSubmit();
  }

  function onVoiceConfirm(payload: QuoteVoiceConfirmPayload) {
    submitAfterConfirm({
      category: payload.category,
      description: payload.description,
      laborAmount: payload.laborAmount,
      needsPart: payload.needsPart,
    });
  }

  return (
    <div className="no-print quote-append-panel" data-testid="quote-append-with-voice">
      <QuoteVoiceCapture dense onConfirm={onVoiceConfirm} />
      <CategoryGuidedPicker
        categories={serviceCatalog.map((service) => service.category)}
        onConfirm={(payload) =>
          submitAfterConfirm({
            category: payload.category,
            description: payload.description,
            laborAmount: payload.laborAmount,
            needsPart: payload.needsPart,
          })
        }
      />
      <FunilariaGuidedPicker
        onConfirm={(payload) =>
          submitAfterConfirm({
            category: payload.category,
            description: payload.description,
            laborAmount: payload.laborAmount,
            needsPart: payload.needsPartHint,
          })
        }
      />
      <form ref={formRef} action={addAction} className="quote-append-form">
        <input type="hidden" name="quote_id" value={quoteId} />
        <select name="service_catalog_id" aria-label="Serviço do catálogo" defaultValue="">
          <option value="">Catálogo (opcional)</option>
          {serviceCatalog.map((service) => (
            <option key={service.id} value={service.id}>
              {service.category} — {service.description}
            </option>
          ))}
        </select>
        <input
          ref={categoryRef}
          name="category"
          placeholder="Categoria"
          aria-label="Categoria do serviço"
        />
        <input
          ref={descriptionRef}
          name="description"
          placeholder="Ou descreva o serviço"
          aria-label="Descrição do serviço"
        />
        <input
          ref={laborRef}
          name="labor_amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="MO unit. (R$)"
          aria-label="Valor unitário da mão de obra"
        />
        <input
          name="quantity"
          type="number"
          min="0.001"
          step="0.001"
          defaultValue="1"
          placeholder="Qtd."
          aria-label="Quantidade do serviço"
        />
        <label className="quote-append-check">
          <input ref={needsPartRef} name="needs_part" type="checkbox" /> Peça?
        </label>
        <button type="submit" className="orbiq-primary-button">
          + Serviço
        </button>
      </form>
    </div>
  );
}
