"use client";

import { useSyncExternalStore } from "react";

import styles from "./connectivity-status.module.css";

const CONNECTIVITY_MESSAGE = "ORBIQ_CONNECTIVITY";

function reportConnectivity() {
  navigator.serviceWorker?.controller?.postMessage({
    online: navigator.onLine,
    type: CONNECTIVITY_MESSAGE,
  });
}

function subscribe(callback: () => void) {
  const handleConnectivityChange = () => {
    reportConnectivity();
    callback();
  };

  window.addEventListener("online", handleConnectivityChange);
  window.addEventListener("offline", handleConnectivityChange);
  navigator.serviceWorker?.addEventListener(
    "controllerchange",
    reportConnectivity,
  );
  reportConnectivity();

  return () => {
    window.removeEventListener("online", handleConnectivityChange);
    window.removeEventListener("offline", handleConnectivityChange);
    navigator.serviceWorker?.removeEventListener(
      "controllerchange",
      reportConnectivity,
    );
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function ConnectivityStatus() {
  const online = useSyncExternalStore(
    subscribe,
    getOnlineSnapshot,
    getServerSnapshot,
  );

  if (online) {
    return null;
  }

  return (
    <aside
      className={styles.status}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={styles.indicator} aria-hidden="true" />
      <span>
        <strong>Sem conexão</strong>
        <small>Reconecte antes de salvar alterações.</small>
      </span>
    </aside>
  );
}
