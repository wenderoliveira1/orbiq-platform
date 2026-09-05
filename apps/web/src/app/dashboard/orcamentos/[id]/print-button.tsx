"use client";

export function PrintButton() {
  return (
    <>
      <style>{`
        @media print {
          .print-header {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas: "workshop brand";
            align-items: end;
            gap: 18px;
            margin-bottom: 18px;
            padding-bottom: 12px;
            border-bottom: 2px solid #111;
          }

          .print-header span {
            grid-area: workshop;
            display: block;
            font-size: 26px !important;
            font-weight: 900;
            line-height: 1.08;
            letter-spacing: -0.02em;
            color: #111 !important;
          }

          .print-header span::before {
            content: "OFICINA";
            display: block;
            margin-bottom: 4px;
            color: #555;
            font-size: 8px;
            font-weight: 900;
            line-height: 1;
            letter-spacing: 0.14em;
          }

          .print-header strong {
            grid-area: brand;
            align-self: end;
            font-size: 9px !important;
            font-weight: 800;
            line-height: 1;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #666 !important;
          }
        }
      `}</style>

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
    </>
  );
}
