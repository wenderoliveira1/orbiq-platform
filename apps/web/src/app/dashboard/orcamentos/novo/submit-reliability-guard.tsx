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

    function setPending(pending: boolean) {
      locked = pending;
      submitButton.disabled = pending || !form.checkValidity();
      submitButton.setAttribute("aria-busy", pending ? "true" : "false");
      submitButton.textContent = pending ? PENDING_LABEL : ORIGINAL_LABEL;
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
      setPending(false);
    }

    form.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      form.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return null;
}
