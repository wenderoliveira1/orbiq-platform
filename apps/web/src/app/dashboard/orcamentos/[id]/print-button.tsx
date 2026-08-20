"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      className="orbiq-secondary-button no-print"
      onClick={
        () =>
          window.print()
      }
    >
      Imprimir / PDF
    </button>
  );
}