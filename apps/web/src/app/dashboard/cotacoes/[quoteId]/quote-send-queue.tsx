"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type RequestItem = {
  id: string;
  supplier: string;
  whatsapp: string;
  status: string;
};


export function QuoteSendQueue({
  requests,
}: {
  requests:
    RequestItem[];
}) {
  const router =
    useRouter();


  const active =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            request.status !==
            "cancelled",
        ),
      [
        requests,
      ],
    );


  const [
    index,
    setIndex,
  ] =
    useState(0);


  if (
    active.length ===
    0
  ) {
    return (
      <div className="orbiq-empty compact">
        <strong>
          Nenhuma cotação preparada.
        </strong>

        <span>
          Selecione os fornecedores acima e prepare a fila.
        </span>
      </div>
    );
  }


  const safeIndex =
    Math.min(
      index,
      active.length -
        1,
    );


  const current =
    active[
      safeIndex
    ];


  const finished =
    index >=
    active.length;


  function openCurrent() {
    if (
      !current ||
      finished
    ) {
      return;
    }


    window.open(
      `/dashboard/cotacoes/abrir/${current.id}`,
      "_blank",
      "noopener,noreferrer",
    );


    setIndex(
      (
        previous,
      ) =>
        previous +
        1,
    );


    window.setTimeout(
      () =>
        router.refresh(),
      1000,
    );
  }


  if (
    finished
  ) {
    return (
      <div className="quote-send-finished">
        <strong>
          Fila concluída.
        </strong>

        <span>
          Os fornecedores selecionados já foram abertos no WhatsApp.
        </span>

        <button
          type="button"
          className="orbiq-secondary-button"
          onClick={
            () => {
              setIndex(
                0,
              );

              router.refresh();
            }
          }
        >
          Revisar fila novamente
        </button>
      </div>
    );
  }


  return (
    <div className="quote-send-queue">
      <div>
        <span className="orbiq-eyebrow">
          FILA DE ENVIO
        </span>

        <strong>
          {safeIndex + 1} de{" "}
          {active.length}
        </strong>

        <span>
          {current.supplier}
        </span>

        <small>
          +{current.whatsapp}
        </small>
      </div>


      <button
        type="button"
        className="orbiq-primary-button"
        onClick={
          openCurrent
        }
      >
        Abrir WhatsApp e próximo →
      </button>
    </div>
  );
}