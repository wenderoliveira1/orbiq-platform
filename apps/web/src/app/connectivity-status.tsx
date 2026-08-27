"use client";

import { useSyncExternalStore } from "react";

import styles from "./connectivity-status.module.css";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
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
