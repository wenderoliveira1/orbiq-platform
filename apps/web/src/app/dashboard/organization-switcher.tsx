"use client";

import { useRef } from "react";

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
  const formRef = useRef<HTMLFormElement>(null);
  const current = organizations.find(
    (organization) => organization.id === currentOrganizationId,
  );
  const canSwitch = organizations.length > 1;

  return (
    <form
      ref={formRef}
      action={action}
      aria-label="Troca de oficina"
      style={{ display: "grid", gap: 8 }}
    >
      <label style={{ display: "grid", gap: 6 }}>
        <span className="orbiq-eyebrow">OFICINA ATIVA</span>

        <select
          name="organization_id"
          aria-label="Oficina ativa"
          defaultValue={currentOrganizationId}
          disabled={!canSwitch}
          onChange={() => formRef.current?.requestSubmit()}
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
            cursor: canSwitch ? "pointer" : "default",
          }}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>

      <span className="orbiq-role">
        {ROLE_LABELS[current?.role ?? ""] ?? current?.role ?? "Usuário"}
        {canSwitch ? " · troque a oficina acima" : " · 1 oficina vinculada"}
      </span>
    </form>
  );
}
