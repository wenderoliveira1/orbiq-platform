"use client";

import { useTransition, type ChangeEvent } from "react";

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
  action: (formData: FormData) => void | Promise<void>;
};

export function OrganizationSwitcher({
  organizations,
  currentOrganizationId,
  action,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const current = organizations.find(
    (organization) => organization.id === currentOrganizationId,
  );
  const canSwitch = organizations.length > 1;

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

    startTransition(async () => {
      await action(formData);
    });
  }

  return (
    <form
      action={action}
      aria-label="Troca de oficina"
      style={{ display: "grid", gap: 8 }}
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
        {ROLE_LABELS[current?.role ?? ""] ?? current?.role ?? "Usuário"}
        {isPending
          ? " · trocando oficina..."
          : canSwitch
            ? " · troque a oficina acima"
            : " · 1 oficina vinculada"}
      </span>
    </form>
  );
}
