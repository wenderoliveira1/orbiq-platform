"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./pwa-registration.module.css";

const SKIP_WAITING_MESSAGE = "ORBIQ_SKIP_WAITING";
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function PwaRegistration() {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const dismissedWorker = useRef<ServiceWorker | null>(null);
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistration("/")
        .then((currentRegistration) => {
          if (currentRegistration?.active?.scriptURL.endsWith("/sw.js")) {
            return currentRegistration.unregister();
          }
        })
        .catch(() => {
          // O ambiente de desenvolvimento continua sem depender do registro.
        });

      return;
    }

    let disposed = false;
    let intervalId: number | undefined;
    let currentRegistration: ServiceWorkerRegistration | null = null;

    const surfaceWaitingWorker = (worker: ServiceWorker | null) => {
      if (!worker || worker === dismissedWorker.current || disposed) {
        return;
      }

      setUpdateAvailable(true);
    };

    const inspectUpdate = () => {
      if (!currentRegistration) {
        return;
      }

      surfaceWaitingWorker(currentRegistration.waiting);
    };

    const checkForUpdate = () => {
      if (!currentRegistration || !navigator.onLine) {
        return;
      }

      void currentRegistration.update().then(inspectUpdate).catch(() => {
        // A próxima retomada/foco tentará novamente sem interromper o usuário.
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    const handleControllerChange = () => {
      if (!reloadRequested.current) {
        return;
      }

      reloadRequested.current = false;
      window.location.reload();
    };

    const register = async () => {
      try {
        const nextRegistration = await navigator.serviceWorker.register(
          "/sw.js",
          {
            scope: "/",
            updateViaCache: "none",
          },
        );

        if (disposed) {
          return;
        }

        currentRegistration = nextRegistration;
        setRegistration(nextRegistration);
        inspectUpdate();

        nextRegistration.addEventListener("updatefound", () => {
          const installing = nextRegistration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              surfaceWaitingWorker(nextRegistration.waiting ?? installing);
            }
          });
        });

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("online", checkForUpdate);
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          handleControllerChange,
        );

        intervalId = window.setInterval(
          checkForUpdate,
          UPDATE_CHECK_INTERVAL_MS,
        );

        checkForUpdate();
      } catch {
        // Registro progressivo: a aplicação online continua funcional.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      disposed = true;
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", checkForUpdate);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );

      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const deferUpdate = () => {
    dismissedWorker.current = registration?.waiting ?? null;
    setUpdateAvailable(false);
  };

  const applyUpdate = () => {
    const waiting = registration?.waiting;
    if (!waiting) {
      setUpdateAvailable(false);
      return;
    }

    reloadRequested.current = true;
    setUpdating(true);
    waiting.postMessage({ type: SKIP_WAITING_MESSAGE });
  };

  if (!updateAvailable && !updating) {
    return null;
  }

  return (
    <aside
      className={styles.notice}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-orbiq-pwa-update
    >
      <span className={styles.mark} aria-hidden="true">
        ↻
      </span>
      <span className={styles.copy}>
        <strong>{updating ? "Atualizando Orbiq" : "Nova versão disponível"}</strong>
        <small>
          {updating
            ? "A nova versão será aberta assim que estiver pronta."
            : "Salve qualquer edição em andamento antes de atualizar."}
        </small>
      </span>

      {!updating ? (
        <span className={styles.actions}>
          <button type="button" onClick={deferUpdate} className={styles.later}>
            Depois
          </button>
          <button type="button" onClick={applyUpdate} className={styles.update}>
            Atualizar agora
          </button>
        </span>
      ) : (
        <span className={styles.progress} aria-hidden="true" />
      )}
    </aside>
  );
}
