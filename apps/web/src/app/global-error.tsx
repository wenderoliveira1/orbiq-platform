"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { reportIncidentAction } from "./dashboard/confiabilidade/actions";
import styles from "./system-state.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function incidentFingerprint(error: GlobalErrorProps["error"]) {
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

  return `global_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
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
      source: "global_error",
    }).then((result) => {
      if (result.ok && result.incidentId) {
        setIncidentId(result.incidentId);
      }
    });
  }, [fingerprint]);

  return (
    <html lang="pt-BR">
      <body className={styles.globalBody}>
        <main className={styles.globalState}>
          <section className={styles.stateCard} role="alert" aria-live="assertive">
            <span className={styles.brandMark} aria-hidden="true">O</span>
            <span className={styles.eyebrow}>ORBIQ · CONTINUIDADE</span>
            <h1>Encontramos uma instabilidade.</h1>
            <p>
              Seus dados permanecem protegidos. A ocorrência foi registrada e você pode tentar recuperar a aplicação agora.
            </p>

            <div className={styles.actions}>
              <button type="button" className={styles.primaryAction} onClick={reset}>
                Recuperar aplicação
              </button>
              <a href="/dashboard" className={styles.secondaryAction}>
                Voltar ao dashboard
              </a>
            </div>

            <small className={styles.reference}>
              Referência técnica: {incidentId ?? fingerprint}
            </small>
          </section>
        </main>
      </body>
    </html>
  );
}
