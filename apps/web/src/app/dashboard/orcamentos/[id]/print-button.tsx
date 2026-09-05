"use client";

export function PrintButton() {
  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        @media print {
          html,
          body {
            width: 100%;
            min-height: 100%;
          }

          .quote-detail-page {
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 9pt !important;
            line-height: 1.25 !important;
          }

          .print-header {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas: "workshop brand";
            align-items: end;
            gap: 10px;
            margin: 0 0 9px !important;
            padding: 0 0 7px !important;
            border-bottom: 2px solid #111;
          }

          .print-header span {
            grid-area: workshop;
            display: block;
            font-size: 21px !important;
            font-weight: 900;
            line-height: 1.05;
            letter-spacing: -0.02em;
            color: #111 !important;
          }

          .print-header span::before {
            content: "OFICINA";
            display: block;
            margin-bottom: 3px;
            color: #555;
            font-size: 7px;
            font-weight: 900;
            line-height: 1;
            letter-spacing: 0.14em;
          }

          .print-header strong {
            grid-area: brand;
            align-self: end;
            font-size: 8px !important;
            font-weight: 800;
            line-height: 1;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #555 !important;
          }

          .print-header strong::after {
            content: " • ORÇAMENTO";
          }

          .quote-detail-heading .orbiq-eyebrow {
            display: none !important;
          }

          .quote-detail-heading {
            margin-bottom: 7px !important;
            padding: 0 !important;
          }

          .quote-detail-heading h1 {
            margin: 0 0 3px !important;
            font-size: 17px !important;
            line-height: 1.05 !important;
          }

          .quote-detail-meta {
            gap: 6px !important;
            font-size: 7.5pt !important;
            line-height: 1.1 !important;
          }

          .quote-detail-grid {
            gap: 7px !important;
            margin-bottom: 7px !important;
          }

          .quote-detail-page .orbiq-panel,
          .quote-detail-page .quote-detail-grid > .orbiq-panel {
            padding: 7px !important;
            margin-bottom: 7px !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .quote-detail-page .orbiq-panel-heading {
            margin-bottom: 5px !important;
            gap: 6px !important;
          }

          .quote-detail-page .orbiq-panel h2 {
            margin: 0 !important;
            font-size: 10.5pt !important;
            line-height: 1.1 !important;
          }

          .quote-detail-page .orbiq-eyebrow {
            font-size: 6.5px !important;
            line-height: 1 !important;
            letter-spacing: 0.1em !important;
          }

          .quote-detail-page .quote-detail-info {
            gap: 2px 7px !important;
            font-size: 7.5pt !important;
          }

          .quote-detail-page .quote-detail-info strong {
            font-size: 8pt !important;
          }

          .quote-detail-page .quote-detail-table {
            font-size: 7.5pt !important;
            line-height: 1.15 !important;
          }

          .quote-detail-page .quote-detail-table-head,
          .quote-detail-page .quote-detail-table-row {
            gap: 5px !important;
            padding: 4px 0 !important;
          }

          .quote-detail-page .quote-detail-table-head span,
          .quote-detail-page .quote-detail-table-row span,
          .quote-detail-page .quote-detail-table-row strong {
            overflow-wrap: anywhere;
          }

          .quote-detail-page .quote-detail-vehicle-title {
            gap: 6px !important;
            margin-bottom: 4px !important;
          }

          .quote-detail-page .orbiq-plate {
            font-size: 7.5pt !important;
          }

          .quote-detail-page .quote-detail-totals {
            gap: 7px !important;
            margin-top: 7px !important;
            padding: 7px !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .quote-detail-page .quote-detail-totals > div {
            padding: 5px 0 !important;
          }

          .quote-detail-page .quote-detail-totals span {
            font-size: 7pt !important;
          }

          .quote-detail-page .quote-detail-totals strong {
            font-size: 9pt !important;
          }

          .quote-detail-page .quote-detail-totals .main-total strong {
            font-size: 13pt !important;
          }

          .quote-detail-page .quote-detail-notes {
            margin: 4px 0 0 !important;
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
          }

          .quote-detail-page .print-footer {
            margin-top: 7px !important;
            padding-top: 5px !important;
            font-size: 6.5pt !important;
          }

          .quote-detail-page .orbiq-panel:has(.orbiq-empty.compact) {
            display: none !important;
          }

          .quote-detail-page:not(:has(.quote-detail-table.item-table))
            .quote-detail-totals > div:nth-child(2) {
            display: none !important;
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
