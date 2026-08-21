"use client";

import {
  useEffect,
  useState,
} from "react";


export function InviteLinkCard({
  token,
  email,
}: {
  token: string;
  email: string;
}) {

  const relative =
    `/convite/${token}`;


  const [
    url,
    setUrl,
  ] =
    useState(
      relative,
    );


  const [
    copied,
    setCopied,
  ] =
    useState(
      false,
    );


  useEffect(
    () => {

      setUrl(
        window.location.origin +
        relative,
      );
    },
    [
      relative,
    ],
  );


  async function copy() {

    try {

      await navigator.clipboard.writeText(
        url,
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

      window.alert(
        "Não foi possível copiar automaticamente.",
      );
    }
  }


  return (
    <section className="team-invite-created">

      <div>

        <span>
          CONVITE CRIADO
        </span>

        <strong>
          {email}
        </strong>

        <p>
          Envie este endereço somente para o funcionário convidado. O link expira em 7 dias.
        </p>

      </div>


      <code>
        {url}
      </code>


      <div className="team-invite-created-actions">

        <button
          type="button"
          className="orbiq-primary-button"
          onClick={copy}
        >
          {copied
            ? "Link copiado"
            : "Copiar convite"}
        </button>


        <a
          href={relative}
          target="_blank"
          rel="noreferrer"
          className="orbiq-secondary-button"
        >
          Abrir convite
        </a>

      </div>

    </section>
  );
}