"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./pwa-registration.module.css";

const SKIP_WAITING_MESSAGE = "ORBIQ_SKIP_WAITING";
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const CONTROLLER_CHANGE_TIMEOUT_MS = 12_000;

export function PwaRegistration() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const dismissedWorker = useRef<ServiceWorker | null>(null);
  const reloadRequested = useRef(false);
  const commandSentForWorker = useRef<ServiceWorker | null>(null);
  const timeoutId = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistration("/").then((current) => {
        if (current?.active?.scriptURL.endsWith("/sw.js")) return current.unregister();
      }).catch(() => undefined);
      return;
    }

    let disposed = false;
    let intervalId: number | undefined;
    let currentRegistration: ServiceWorkerRegistration | null = null;

    const clearUpdateTimeout = () => {
      if (timeoutId.current !== undefined) {
        window.clearTimeout(timeoutId.current);
        timeoutId.current = undefined;
      }
    };

    const surfaceWaitingWorker = (worker: ServiceWorker | null) => {
      if (!worker || worker === dismissedWorker.current || disposed) return;
      setUpdateError(false);
      setUpdateAvailable(true);
    };

    const inspectUpdate = () => surfaceWaitingWorker(currentRegistration?.waiting ?? null);

    const checkForUpdate = () => {
      if (!currentRegistration || !navigator.onLine || updating) return;
      void currentRegistration.update().then(inspectUpdate).catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    const handleControllerChange = () => {
      if (!reloadRequested.current) return;
      clearUpdateTimeout();
      reloadRequested.current = false;
      window.location.reload();
    };

    const register = async () => {
      try {
        const nextRegistration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;
        currentRegistration = nextRegistration;
        setRegistration(nextRegistration);
        inspectUpdate();

        nextRegistration.addEventListener("updatefound", () => {
          const installing = nextRegistration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              surfaceWaitingWorker(nextRegistration.waiting ?? installing);
            }
          });
        });

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("online", checkForUpdate);
        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
        intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
        checkForUpdate();
      } catch {
        setUpdateError(true);
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      disposed = true;
      clearUpdateTimeout();
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [updating]);

  const deferUpdate = () => {
    dismissedWorker.current = registration?.waiting ?? null;
    setUpdateAvailable(false);
    setUpdateError(false);
  };

  const applyUpdate = () => {
    const waiting = registration?.waiting;
    if (!waiting || commandSentForWorker.current === waiting) return;

    commandSentForWorker.current = waiting;
    reloadRequested.current = true;
    setUpdateAvailable(false);
    setUpdateError(false);
    setUpdating(true);
    waiting.postMessage({ type: SKIP_WAITING_MESSAGE });

    timeoutId.current = window.setTimeout(() => {
      if (!reloadRequested.current) return;
      reloadRequested.current = false;
      commandSentForWorker.current = null;
      setUpdating(false);
      setUpdateError(true);
      setUpdateAvailable(true);
      timeoutId.current = undefined;
    }, CONTROLLER_CHANGE_TIMEOUT_MS);
  };

  const retryUpdate = () => {
    commandSentForWorker.current = null;
    setUpdateError(false);
    setUpdateAvailable(true);
    setUpdating(false);
  };

  if (!updateAvailable && !updating && !updateError) return null;

  return (
    <aside className={styles.notice} role="status" aria-live="polite" aria-atomic="true" data-orbiq-pwa-update>
      <span className={styles.mark} aria-hidden="true">↻</span>
      <span className={styles.copy}>
        <strong>{updateError ? "Não foi possível atualizar agora" : updating ? "Atualizando Orbiq" : "Nova versão disponível"}</strong>
        <small>
          {updateError
            ? "A sessão foi preservada. Você pode tentar novamente quando quiser."
            : updating
              ? "A nova versão será aberta assim que estiver pronta."
              : "Salve qualquer edição em andamento antes de atualizar."}
        </small>
      </span>
      {updateError ? (
        <span className={styles.actions}>
          <button type="button" onClick={deferUpdate} className={styles.later}>Depois</button>
          <button type="button" onClick={retryUpdate} className={styles.update}>Tentar novamente</button>
        </span>
      ) : !updating ? (
        <span className={styles.actions}>
          <button type="button" onClick={deferUpdate} className={styles.later}>Depois</button>
          <button type="button" onClick={applyUpdate} className={styles.update}>Atualizar agora</button>
        </span>
      ) : (
        <span className={styles.progress} aria-hidden="true" />
      )}
    </aside>
  );
}
