"use client";

type PrintButtonProps = {
  documentTitle?: string;
};

export function PrintButton({ documentTitle }: PrintButtonProps) {
  return (
    <button
      type="button"
      className="orbiq-secondary-button no-print"
      data-testid="quote-detail-print"
      onClick={() => {
        const previousTitle = document.title;
        if (documentTitle) {
          document.title = documentTitle;
        }
        const restore = () => {
          document.title = previousTitle;
          window.removeEventListener("afterprint", restore);
        };
        window.addEventListener("afterprint", restore);
        window.print();
        // Fallback when afterprint is delayed/missing
        window.setTimeout(restore, 1000);
      }}
    >
      Imprimir / PDF
    </button>
  );
}
