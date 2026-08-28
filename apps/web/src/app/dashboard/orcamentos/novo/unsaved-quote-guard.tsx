"use client";

import { useEffect } from "react";

const FORM_SELECTOR = "form.quote-builder";
const MESSAGE = "Há alterações não salvas neste orçamento. Deseja sair mesmo assim?";

export function UnsavedQuoteGuard() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(FORM_SELECTOR);

    if (!form) {
      return;
    }

    let dirty = false;

    const markDirty = () => {
      dirty = true;
    };

    const markDirtyFromButton = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest<HTMLButtonElement>('button[type="button"]');

      if (button && form.contains(button) && !button.disabled) {
        dirty = true;
      }
    };

    const markSubmitted = () => {
      dirty = false;
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) {
        return;
      }

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${destination.pathname}${destination.search}${destination.hash}`;

      if (current === next || window.confirm(MESSAGE)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("click", markDirtyFromButton);
    form.addEventListener("submit", markSubmitted);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("click", markDirtyFromButton);
      form.removeEventListener("submit", markSubmitted);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, []);

  return null;
}
