"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";


type Props = {
  quoteId: string;
  protocol: string;
  workshopName: string;
  customerName: string;
  customerPhone: string | null;
  vehiclePlate: string;
  totalFormatted: string;
};


function normalizePhone(
  raw: string | null,
): string | null {

  const digits =
    String(
      raw ?? "",
    ).replace(
      /\D/g,
      "",
    );


  if (!digits) {
    return null;
  }


  if (
    digits.startsWith("55") &&
    (
      digits.length === 12 ||
      digits.length === 13
    )
  ) {
    return digits;
  }


  if (
    digits.length === 10 ||
    digits.length === 11
  ) {
    return `55${digits}`;
  }


  return digits;
}


export function CustomerQuoteToolbar({
  quoteId,
  protocol,
  workshopName,
  customerName,
  customerPhone,
  vehiclePlate,
  totalFormatted,
}: Props) {

  const [
    copied,
    setCopied,
  ] =
    useState(false);


  const firstName =
    customerName
      .trim()
      .split(/\s+/)[0] ||
    customerName;


  const message =
    useMemo(
      () =>
        [
          `Olá, ${firstName}!`,
          "",
          `Segue o orçamento ${protocol} da ${workshopName}.`,
          `Veículo: ${vehiclePlate}.`,
          `Valor total: ${totalFormatted}.`,
          "",
          "Qualquer dúvida, estamos à disposição.",
        ].join("\n"),
      [
        firstName,
        protocol,
        workshopName,
        vehiclePlate,
        totalFormatted,
      ],
    );


  const phone =
    normalizePhone(
      customerPhone,
    );


  const whatsappUrl =
    phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(
          message,
        )}`
      : null;


  async function copyMessage() {

    try {

      await navigator.clipboard.writeText(
        message,
      );


      setCopied(true);


      window.setTimeout(
        () => {
          setCopied(false);
        },
        1800,
      );
    }
    catch {

      window.alert(
        "Não foi possível copiar automaticamente.",
      );
    }
  }


  return (
    <div className="customer-quote-toolbar">

      <Link
        href={`/dashboard/comercial/${quoteId}`}
        className="orbiq-secondary-button"
      >
        ← Voltar ao Comercial
      </Link>


      <div>

        <button
          type="button"
          className="orbiq-secondary-button"
          onClick={copyMessage}
        >
          {copied
            ? "Resumo copiado"
            : "Copiar resumo"}
        </button>


        {whatsappUrl ? (

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="orbiq-secondary-button"
          >
            Enviar no WhatsApp
          </a>

        ) : (

          <button
            type="button"
            className="orbiq-secondary-button"
            disabled
          >
            WhatsApp indisponível
          </button>

        )}


        <button
          type="button"
          className="orbiq-primary-button"
          onClick={() => window.print()}
        >
          Imprimir / Salvar PDF
        </button>

      </div>

    </div>
  );
}