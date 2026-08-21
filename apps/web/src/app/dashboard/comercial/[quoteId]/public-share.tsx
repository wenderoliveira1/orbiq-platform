"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  createPublicLinkAction,
  revokePublicLinkAction,
} from "./public-share-actions";


export function PublicQuoteShare({
  quoteId,
}: {
  quoteId:
    string;
}) {

  const [
    isPending,
    startTransition,
  ] =
    useTransition();


  const [
    publicUrl,
    setPublicUrl,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  function generate() {

    setMessage(
      null,
    );


    startTransition(
      async () => {

        const result =
          await createPublicLinkAction(
            quoteId,
          );


        if (
          result.error
        ) {

          setMessage(
            result.error,
          );

          return;
        }


        if (
          !result.token
        ) {

          setMessage(
            "Token não retornado.",
          );

          return;
        }


        const url =
          `${window.location.origin}/orcamento/${result.token}`;


        setPublicUrl(
          url,
        );


        try {

          await navigator.clipboard.writeText(
            url,
          );


          setMessage(
            "Link criado e copiado.",
          );
        }
        catch {

          setMessage(
            "Link criado.",
          );
        }
      },
    );
  }


  function revoke() {

    startTransition(
      async () => {

        const result =
          await revokePublicLinkAction(
            quoteId,
          );


        if (
          result.error
        ) {

          setMessage(
            result.error,
          );

          return;
        }


        setPublicUrl(
          null,
        );


        setMessage(
          "Link revogado.",
        );
      },
    );
  }


  async function copy() {

    if (!publicUrl) {
      return;
    }


    await navigator.clipboard.writeText(
      publicUrl,
    );


    setMessage(
      "Link copiado.",
    );
  }


  return (
    <div className="commercial-public-share">

      {!publicUrl ? (

        <button
          type="button"
          className="orbiq-secondary-button"
          disabled={
            isPending
          }
          onClick={
            generate
          }
        >
          {isPending
            ? "Gerando..."
            : "Gerar link do cliente"}
        </button>

      ) : (

        <>

          <button
            type="button"
            className="orbiq-primary-button"
            onClick={
              () =>
                window.open(
                  publicUrl,
                  "_blank",
                  "noopener,noreferrer",
                )
            }
          >
            Abrir link público
          </button>


          <button
            type="button"
            className="orbiq-secondary-button"
            onClick={
              copy
            }
          >
            Copiar link
          </button>


          <button
            type="button"
            className="orbiq-secondary-button"
            disabled={
              isPending
            }
            onClick={
              revoke
            }
          >
            Revogar
          </button>

        </>

      )}


      {message ? (

        <small>
          {message}
        </small>

      ) : null}

    </div>
  );
}