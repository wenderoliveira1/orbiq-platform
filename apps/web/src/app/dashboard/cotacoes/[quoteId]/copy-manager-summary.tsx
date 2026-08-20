"use client";

import {
  useState,
} from "react";


export function CopyManagerSummary({
  text,
}: {
  text: string;
}) {
  const [
    copied,
    setCopied,
  ] =
    useState(false);


  async function copy() {
    try {
      await navigator.clipboard.writeText(
        text,
      );

      setCopied(
        true,
      );

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1800,
      );
    }
    catch {
      setCopied(
        false,
      );
    }
  }


  return (
    <button
      type="button"
      className="orbiq-secondary-button"
      onClick={
        copy
      }
    >
      {copied
        ? "Resumo copiado"
        : "Copiar resumo p/ gestor"}
    </button>
  );
}