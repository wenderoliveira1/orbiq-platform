"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { createAdditionalOrganizationAction } from "./actions";

type CreateOrganizationFormProps = {
  defaultEmail: string;
};

export function CreateOrganizationForm({
  defaultEmail,
}: CreateOrganizationFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await createAdditionalOrganizationAction(
        new FormData(event.currentTarget),
      );

      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }

      window.location.replace(
        "/dashboard?organization_switched=1&organization_created=1",
      );
    } catch {
      setError(
        "Não foi possível criar a oficina agora. Tente novamente.",
      );
      setPending(false);
    }
  }

  return (
    <form
      className="orbiq-form"
      style={{ marginTop: 18 }}
      onSubmit={handleSubmit}
    >
      {error ? (
        <div className="orbiq-alert error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="orbiq-form-row">
        <label>
          <span>NOME DA OFICINA</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Ex.: Innovate Automotiva — Filial Centro"
          />
        </label>

        <label>
          <span>IDENTIFICADOR EXCLUSIVO</span>
          <input
            name="slug"
            maxLength={120}
            placeholder="Ex.: innovate-filial-centro"
          />
          <small>
            Se ficar vazio, o Orbiq criará a partir do nome.
          </small>
        </label>
      </div>

      <div className="orbiq-form-row">
        <label>
          <span>RAZÃO SOCIAL</span>
          <input
            name="legal_name"
            maxLength={160}
            placeholder="Opcional"
          />
        </label>

        <label>
          <span>CNPJ</span>
          <input
            name="cnpj"
            inputMode="numeric"
            maxLength={18}
            placeholder="00.000.000/0000-00"
          />
          <small>
            Quando informado, não poderá pertencer a outra oficina.
          </small>
        </label>
      </div>

      <div className="orbiq-form-row">
        <label>
          <span>TELEFONE</span>
          <input
            name="phone"
            aria-label="Telefone"
            maxLength={30}
            placeholder="(00) 0000-0000"
          />
        </label>

        <label>
          <span>WHATSAPP</span>
          <input
            name="whatsapp"
            aria-label="WhatsApp"
            maxLength={30}
            placeholder="(00) 00000-0000"
          />
          <small>
            Informe pelo menos telefone ou WhatsApp.
          </small>
        </label>
      </div>

      <div className="orbiq-form-row">
        <label>
          <span>E-MAIL DA OFICINA</span>
          <input
            name="email"
            type="email"
            maxLength={160}
            defaultValue={defaultEmail}
            placeholder="contato@oficina.com.br"
          />
        </label>

        <label>
          <span>CIDADE</span>
          <input
            name="city"
            required
            minLength={2}
            maxLength={120}
          />
        </label>

        <label>
          <span>UF</span>
          <input
            name="state"
            required
            minLength={2}
            maxLength={2}
            placeholder="MG"
          />
        </label>
      </div>

      <div
        style={{
          padding: 14,
          border: "1px solid var(--orbiq-border)",
          borderRadius: 14,
        }}
      >
        <strong>Isolamento garantido</strong>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Nenhum cliente, veículo, orçamento ou fornecedor da oficina
          atual será copiado para a nova operação.
        </p>
      </div>

      <div>
        <button
          type="submit"
          className="orbiq-primary-button"
          disabled={pending}
          aria-busy={pending}
        >
          {pending
            ? "Criando e ativando oficina..."
            : "Criar e ativar nova oficina"}
        </button>
      </div>
    </form>
  );
}
