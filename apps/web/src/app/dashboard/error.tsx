"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { reportIncidentAction } from "./confiabilidade/actions";
import styles from "../system-state.module.css";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function incidentFingerprint(error: ErrorPageProps["error"]) {
  const digest = error.digest?.trim();

  if (digest && /^[A-Za-z0-9:_-]{8,116}$/.test(digest)) {
    return `next_${digest}`;
  }

  const input = `${error.name}:${error.message}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `client_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  const reported = useRef(false);
  const fingerprint = useMemo(() => incidentFingerprint(error), [error]);
  const [incidentId, setIncidentId] = useState<string | null>(null);

  useEffect(() => {
    if (reported.current) {
      return;
    }

    reported.current = true;
    void reportIncidentAction({
      fingerprint,
      route: window.location.pathname,
      source: "dashboard_error",
    }).then((result) => {
      if (result.ok && result.incidentId) {
        setIncidentId(result.incidentId);
      }
    });
  }, [fingerprint]);

  return (
    <main className={styles.dashboardState}>
      <section className={styles.stateCard} role="alert" aria-live="assertive">
        <span className={styles.statusIcon} aria-hidden="true">!</span>
        <span className={styles.eyebrow}>RECUPERAÇÃO SEGURA</span>
        <h1>Não foi possível concluir esta tela.</h1>
        <p>
          A ocorrência foi registrada de forma protegida. Tente novamente ou volte à visão geral para continuar trabalhando.
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.primaryAction} onClick={reset}>
            Tentar novamente
          </button>
          <Link href="/dashboard" className={styles.secondaryAction}>
            Ir para a visão geral
          </Link>
        </div>

        <small className={styles.reference}>
          Referência técnica: {incidentId ?? fingerprint}
        </small>
      </section>
    </main>
  );
}
