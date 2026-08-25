import { CreateOrganizationForm } from "./create-organization-form";

import { requireCurrentPermission } from "../_lib/permissions";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  estimator: "Orçamentista",
  technician: "Técnico",
  viewer: "Somente leitura",
};

type PageProps = {
  searchParams: Promise<{
    created?: string;
    error?: string;
  }>;
};

export default async function OrganizationsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const {
    organization,
    availableOrganizations,
    user,
  } = await requireCurrentPermission(
    "organizations.manage",
  );

  return (
    <div className="orbiq-page">
      <div className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">MULTIEMPRESA</span>
          <h1>Oficinas e filiais</h1>
          <p>
            Crie novas operações com dados isolados e alterne entre elas
            pelo seletor de oficina ativa.
          </p>
        </div>
      </div>

      {params.created === "1" ? (
        <div className="orbiq-alert success">
          Nova oficina criada e ativada com sucesso.
        </div>
      ) : null}

      {params.error ? (
        <div className="orbiq-alert error">
          {params.error}
        </div>
      ) : null}

      <section className="orbiq-panel">
        <span className="orbiq-eyebrow">SUAS OPERAÇÕES</span>
        <h2>Oficinas vinculadas</h2>
        <p className="muted">
          Cada oficina possui equipe, clientes, veículos, orçamentos,
          fornecedores e configurações independentes.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 14,
            marginTop: 18,
          }}
        >
          {availableOrganizations.map((item) => {
            const active = item.id === organization.id;

            return (
              <article
                key={item.id}
                style={{
                  border: active
                    ? "2px solid var(--orbiq-accent)"
                    : "1px solid var(--orbiq-border)",
                  borderRadius: 14,
                  padding: 16,
                  background: "var(--orbiq-surface)",
                }}
              >
                <span className="orbiq-eyebrow">
                  {active ? "OFICINA ATIVA" : "OFICINA VINCULADA"}
                </span>
                <h3 style={{ margin: "8px 0 4px" }}>
                  {item.name}
                </h3>
                <p className="muted" style={{ margin: 0 }}>
                  {ROLE_LABELS[item.role] ?? item.role}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="orbiq-panel">
        <span className="orbiq-eyebrow">NOVA OPERAÇÃO</span>
        <h2>Criar oficina ou filial</h2>
        <p className="muted">
          A nova operação nascerá com você como proprietário, configurações
          comerciais próprias e categorias padrão. Ela será ativada
          automaticamente após a criação.
        </p>

        <CreateOrganizationForm defaultEmail={user.email ?? ""} />
      </section>
    </div>
  );
}
