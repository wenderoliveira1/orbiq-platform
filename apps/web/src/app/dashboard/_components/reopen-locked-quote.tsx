"use client";

import { useMemo, useState } from "react";

import { reopenCommercialAction } from "../comercial/[quoteId]/actions";

type Props = {
  quoteId: string;
  returnTo?: "comercial" | "orcamentos";
  buttonLabel?: string;
  compact?: boolean;
};

export function ReopenLockedQuote({
  quoteId,
  returnTo = "comercial",
  buttonLabel = "Reabrir para editar",
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const canSubmit = useMemo(
    () => confirmation.trim().toLowerCase() === "sim",
    [confirmation],
  );

  if (!open) {
    return (
      <button
        type="button"
        className="orbiq-secondary-button"
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <form
      action={reopenCommercialAction}
      className={
        compact
          ? "reopen-locked-quote reopen-locked-quote-compact"
          : "reopen-locked-quote"
      }
    >
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="return_to" value={returnTo} />

      <div className="reopen-locked-quote-warning">
        <strong>Atenção antes de reabrir</strong>
        <span>
          Este orçamento pode já ter sido enviado ou apresentado ao cliente.
          Reabrir permite alterar valores, quantidades e serviços no mesmo
          orçamento.
        </span>
      </div>

      <label className="reopen-locked-quote-label">
        Digite <strong>sim</strong> para confirmar
        <input
          name="confirmation"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="sim"
          aria-label='Digite sim para confirmar a reabertura'
          required
        />
      </label>

      <div className="reopen-locked-quote-actions">
        <button
          type="button"
          className="orbiq-secondary-button"
          onClick={() => {
            setOpen(false);
            setConfirmation("");
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="orbiq-primary-button"
          disabled={!canSubmit}
        >
          Confirmar reabertura
        </button>
      </div>
    </form>
  );
}
