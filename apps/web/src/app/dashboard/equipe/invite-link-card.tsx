"use client";

import {
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
    copied,
    setCopied,
  ] =
    useState(
      false,
    );


  async function copy() {

    try {

      const absoluteUrl =
        new URL(
          relative,
          window.location.origin,
        ).toString();


      await navigator.clipboard.writeText(
        absoluteUrl,
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
        {relative}
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