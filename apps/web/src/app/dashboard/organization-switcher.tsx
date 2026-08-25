"use client";

import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";

import type {
  SwitchOrganizationResult,
} from "./actions";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  estimator: "Orçamentista",
  technician: "Técnico",
  viewer: "Somente leitura",
};

type OrganizationOption = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  organizations: OrganizationOption[];
  currentOrganizationId: string;
  action: (
    formData: FormData,
  ) => Promise<SwitchOrganizationResult>;
};

export function OrganizationSwitcher({
  organizations,
  currentOrganizationId,
  action,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const current = organizations.find(
    (organization) => organization.id === currentOrganizationId,
  );
  const canSwitch = organizations.length > 1;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function handleOrganizationChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const nextOrganizationId = event.currentTarget.value;

    if (
      !nextOrganizationId ||
      nextOrganizationId === currentOrganizationId
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("organization_id", nextOrganizationId);
    setError(null);

    startTransition(async () => {
      try {
        const result = await action(formData);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        window.location.replace(
          "/dashboard?organization_switched=1",
        );
      } catch {
        setError(
          "Não foi possível trocar de oficina agora. Tente novamente.",
        );
      }
    });
  }

  return (
    <form
      aria-label="Troca de oficina"
      style={{ display: "grid", gap: 8 }}
      onSubmit={handleSubmit}
    >
      <label style={{ display: "grid", gap: 6 }}>
        <span className="orbiq-eyebrow">OFICINA ATIVA</span>

        <select
          name="organization_id"
          aria-label="Oficina ativa"
          aria-busy={isPending}
          defaultValue={currentOrganizationId}
          disabled={!canSwitch || isPending}
          onChange={handleOrganizationChange}
          style={{
            width: "100%",
            minWidth: 0,
            border: "1px solid var(--orbiq-border)",
            borderRadius: 10,
            padding: "10px 34px 10px 11px",
            background: "var(--orbiq-panel)",
            color: "var(--orbiq-text)",
            font: "inherit",
            fontWeight: 700,
            cursor: canSwitch && !isPending ? "pointer" : "default",
          }}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>

      <span className="orbiq-role" aria-live="polite">
        {error ??
          (ROLE_LABELS[current?.role ?? ""] ??
            current?.role ??
            "Usuário")}
        {!error &&
          (isPending
            ? " · trocando oficina..."
            : canSwitch
              ? " · troque a oficina acima"
              : " · 1 oficina vinculada")}
      </span>
    </form>
  );
}
