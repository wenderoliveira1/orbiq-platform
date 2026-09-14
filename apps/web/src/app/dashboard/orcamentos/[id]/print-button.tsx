"use client";

type PrintButtonProps = {
  documentTitle?: string;
  label?: string;
};

export function PrintButton({ documentTitle, label = "Imprimir / PDF" }: PrintButtonProps) {
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
        window.setTimeout(restore, 1000);
      }}
    >
      {label}
    </button>
  );
}
