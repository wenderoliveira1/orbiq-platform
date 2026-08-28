"use client";

import { useEffect } from "react";

const FORM_SELECTOR = "form.quote-builder";
const SUBMIT_SELECTOR = 'button[type="submit"]';
const ORIGINAL_LABEL = "Salvar orçamento";
const PENDING_LABEL = "Salvando orçamento...";

export function SubmitReliabilityGuard() {
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

    guardedButton.setAttribute("aria-busy", "false");
    guardedForm.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      guardedForm.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return null;
}
