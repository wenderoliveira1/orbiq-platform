"use client";

import { useEffect, useState } from "react";

const FORM_SELECTOR = "form.quote-builder";
const SUBMIT_SELECTOR = 'button[type="submit"]';
const ORIGINAL_LABEL = "Salvar orçamento";
const PENDING_LABEL = "Salvando orçamento...";

export function SubmitReliabilityGuard() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(FORM_SELECTOR);
    const submitButton = form?.querySelector<HTMLButtonElement>(SUBMIT_SELECTOR);

    if (!form || !submitButton) {
      return;
    }

    const guardedForm = form;
    const guardedButton = submitButton;
    let locked = false;
    let disabledBeforeSubmit = guardedButton.disabled;

    function setPending(pending: boolean) {
      locked = pending;

      if (pending) {
        disabledBeforeSubmit = guardedButton.disabled;
        guardedButton.disabled = true;
        guardedButton.textContent = PENDING_LABEL;
      } else {
        guardedButton.disabled = disabledBeforeSubmit;
        guardedButton.textContent = ORIGINAL_LABEL;
      }

      guardedButton.setAttribute("aria-busy", pending ? "true" : "false");
    }

    function handleSubmit(event: SubmitEvent) {
      if (!navigator.onLine) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOffline(true);
        return;
      }

      if (locked) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (!guardedForm.checkValidity()) {
        return;
      }

      setPending(true);
    }

    function handlePageShow() {
      if (locked) {
        setPending(false);
      } else {
        guardedButton.setAttribute("aria-busy", "false");
      }
    }

    function handleOffline() {
      setOffline(true);
    }

    function handleOnline() {
      setOffline(false);
    }

    guardedButton.setAttribute("aria-busy", "false");
    guardedForm.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    const initialConnectivityCheck = window.setTimeout(() => {
      setOffline(!navigator.onLine);
    }, 0);

    return () => {
      window.clearTimeout(initialConnectivityCheck);
      guardedForm.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <p
      role="alert"
      aria-live="assertive"
      className="mx-auto mb-4 w-full max-w-5xl rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"
    >
      Sem conexão. O orçamento permanece nesta tela e não será enviado até a internet voltar.
    </p>
  );
}
