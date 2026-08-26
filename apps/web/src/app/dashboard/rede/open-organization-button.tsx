"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  switchOrganizationAction,
} from "../actions";

import styles from "./network-overview.module.css";


type OpenOrganizationButtonProps = {
  active:
    boolean;

  organizationId:
    string;

  organizationName:
    string;
};


export function OpenOrganizationButton({
  active,
  organizationId,
  organizationName,
}: OpenOrganizationButtonProps) {

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    pending,
    startTransition,
  ] =
    useTransition();


  function openOrganization() {

    if (
      active ||
      pending
    ) {

      return;
    }


    const formData =
      new FormData();


    formData.set(
      "organization_id",
      organizationId,
    );


    setError(
      null,
    );


    startTransition(
      async () => {

        try {

          const result =
            await switchOrganizationAction(
              formData,
            );


          if (
            !result.ok
          ) {

            setError(
              result.error,
            );

            return;
          }


          window.location.replace(
            "/dashboard?organization_switched=1",
          );
        }
        catch {

          setError(
            "Não foi possível abrir esta operação agora.",
          );
        }
      },
    );
  }


  return (
    <div className={styles.action}>

      <button
        type="button"
        className={
          [
            styles.openButton,
            active
              ? styles.activeButton
              : "",
          ]
            .filter(Boolean)
            .join(" ")
        }
        disabled={
          active ||
          pending
        }
        aria-busy={
          pending
        }
        aria-label={
          active
            ? organizationName + " é a oficina ativa"
            : "Abrir operação " + organizationName
        }
        onClick={
          openOrganization
        }
      >

        {active
          ? "Operação ativa"
          : pending
            ? "Abrindo..."
            : "Abrir operação"}

      </button>


      {error ? (

        <span
          className={styles.actionError}
          role="alert"
        >
          {error}
        </span>

      ) : null}

    </div>
  );
}
