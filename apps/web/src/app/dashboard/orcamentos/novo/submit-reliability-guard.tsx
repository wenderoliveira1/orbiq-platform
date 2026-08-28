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

    let locked = false;
    let disabledBeforeSubmit = submitButton.disabled;

    function setPending(pending: boolean) {
      locked = pending;

      if (pending) {
        disabledBeforeSubmit = submitButton.disabled;
        submitButton.disabled = true;
        submitButton.textContent = PENDING_LABEL;
      } else {
        submitButton.disabled = disabledBeforeSubmit;
        submitButton.textContent = ORIGINAL_LABEL;
      }

      submitButton.setAttribute("aria-busy", pending ? "true" : "false");
    }

    function handleSubmit(event: SubmitEvent) {
      if (locked) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (!form.checkValidity()) {
        return;
      }

      setPending(true);
    }

    function handlePageShow() {
      if (locked) {
        setPending(false);
      } else {
        submitButton.setAttribute("aria-busy", "false");
      }
    }

    submitButton.setAttribute("aria-busy", "false");
    form.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      form.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return null;
}
