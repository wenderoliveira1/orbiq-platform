"use client";

import { useState, useTransition } from "react";

import { switchOrganizationAction } from "../../actions";

import styles from "./network-governance.module.css";

type OpenNetworkEventButtonProps = {
  active: boolean;
  organizationId: string;
  organizationName: string;
  quoteId: string | null;
};

export function OpenNetworkEventButton({
  active,
  organizationId,
  organizationName,
  quoteId,
}: OpenNetworkEventButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openEvent() {
    if (pending) {
      return;
    }

    const destination = quoteId
      ? `/dashboard/orcamentos/${quoteId}`
      : "/dashboard/atividade";

    if (active) {
      window.location.assign(destination);
      return;
    }

    const formData = new FormData();
    formData.set("organization_id", organizationId);
    setError(null);

    startTransition(async () => {
      try {
        const result = await switchOrganizationAction(formData);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        window.location.replace(destination);
      } catch {
        setError("Não foi possível abrir esta atividade agora.");
      }
    });
  }

  return (
    <div className={styles.eventAction}>
      <button
        type="button"
        className={styles.openEventButton}
        disabled={pending}
        aria-busy={pending}
        aria-label={`Abrir atividade em ${organizationName}`}
        onClick={openEvent}
      >
        {pending ? "Abrindo..." : quoteId ? "Abrir orçamento" : "Ver na oficina"}
      </button>

      {error ? (
        <span className={styles.actionError} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
