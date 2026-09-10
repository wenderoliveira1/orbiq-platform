import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  completeOrganizationSetup,
  createOrganization,
} from "./actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OnboardingPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = String(data?.claims?.sub ?? "");

  if (!userId) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const created = params.created === "1";

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Falha ao validar a oficina ativa: ${membershipError.message}`,
    );
  }

  if (!membership) {
    return (
      <main className="page-shell narrow">
        <header className="simple-header">
          <div className="brand-lockup dark-text">
            <div className="brand-mark"><img src="/brand/orbiq-mark.png" alt="" width={32} height={32} /></div>
            <div>
              <strong>Orbiq</strong>
              <span>Configuração inicial</span>
            </div>
          </div>
        </header>

        <section className="setup-card">
          <span className="eyebrow red">ETAPA 1 DE 2</span>
          <h1>Crie sua oficina</h1>
          <p className="muted">
            Esta será sua organização dentro do Orbiq. Sua conta será
            vinculada como proprietária e os dados ficarão isolados das
            demais oficinas da plataforma.
          </p>

          {error ? <div className="notice error">{error}</div> : null}

          <form action={createOrganization} className="form-stack roomy">
            <label>
              <span>Nome da oficina</span>
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                autoFocus
                placeholder="Ex.: Innovate Automotiva"
              />
            </label>

            <label>
              <span>Identificador</span>
              <input name="slug" placeholder="Ex.: innovate-automotiva" />
              <small>
                Se deixar vazio, o Orbiq cria automaticamente a partir do
                nome. Este identificador será exclusivo da sua oficina.
              </small>
            </label>

            <label>
              <span>
                CNPJ <em>opcional</em>
              </span>
              <input name="cnpj" placeholder="00.000.000/0000-00" />
            </label>

            <button className="primary-button" type="submit">
              Criar oficina e continuar
            </button>
          </form>
        </section>
      </main>
    );
  }

  const [organizationResult, settingsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, cnpj")
      .eq("id", membership.organization_id)
      .single(),

    supabase
      .from("organization_settings")
      .select("organization_id")
      .eq("organization_id", membership.organization_id)
      .maybeSingle(),
  ]);

  if (organizationResult.error || !organizationResult.data) {
    throw new Error(
      `Falha ao carregar a oficina: ${
        organizationResult.error?.message ?? "registro não encontrado"
      }`,
    );
  }

  if (settingsResult.error) {
    throw new Error(
      `Falha ao validar a configuração inicial: ${settingsResult.error.message}`,
    );
  }

  if (settingsResult.data) {
    redirect("/dashboard");
  }

  const organization = organizationResult.data;
  const accountEmail = String(data?.claims?.email ?? "");

  return (
    <main className="page-shell narrow">
      <header className="simple-header">
        <div className="brand-lockup dark-text">
          <div className="brand-mark"><img src="/brand/orbiq-mark.png" alt="" width={32} height={32} /></div>
          <div>
            <strong>Orbiq</strong>
            <span>Configuração inicial</span>
          </div>
        </div>
      </header>

      <section className="setup-card">
        <span className="eyebrow red">ETAPA 2 DE 2</span>
        <h1>Complete o perfil da oficina</h1>
        <p className="muted">
          Vamos preparar os dados usados nos orçamentos, documentos e padrões
          comerciais. Depois disso, sua operação estará pronta para entrar no
          Orbiq.
        </p>

        {created ? (
          <div className="notice success">
            Oficina criada. Agora conclua os dados essenciais da operação.
          </div>
        ) : null}

        {error ? <div className="notice error">{error}</div> : null}

        <div
          style={{
            margin: "18px 0",
            padding: 14,
            border: "1px solid var(--orbiq-border)",
            borderRadius: 14,
          }}
        >
          <strong>{organization.name}</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            {organization.slug}
            {organization.cnpj ? ` · ${organization.cnpj}` : ""}
          </div>
        </div>

        <form action={completeOrganizationSetup} className="form-stack roomy">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <label>
              <span>Razão social</span>
              <input
                name="legal_name"
                maxLength={160}
                placeholder="Opcional"
              />
            </label>

            <label>
              <span>E-mail da oficina</span>
              <input
                name="email"
                type="email"
                defaultValue={accountEmail}
                placeholder="contato@oficina.com.br"
              />
            </label>

            <label>
              <span>Telefone</span>
              <input name="phone" placeholder="(00) 0000-0000" />
            </label>

            <label>
              <span>WhatsApp</span>
              <input name="whatsapp" placeholder="(00) 00000-0000" />
              <small>Informe telefone ou WhatsApp para continuar.</small>
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
            }}
          >
            <label>
              <span>CEP</span>
              <input name="postal_code" placeholder="00000-000" />
            </label>

            <label>
              <span>Logradouro</span>
              <input name="address_line" placeholder="Rua / Avenida" />
            </label>

            <label>
              <span>Número</span>
              <input name="address_number" />
            </label>

            <label>
              <span>Complemento</span>
              <input name="address_complement" />
            </label>

            <label>
              <span>Bairro</span>
              <input name="district" />
            </label>

            <label>
              <span>Cidade</span>
              <input name="city" required minLength={2} />
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
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <label>
              <span>Validade padrão do orçamento</span>
              <input
                name="quote_validity_days"
                type="number"
                min={1}
                max={90}
                step={1}
                defaultValue={7}
              />
              <small>Dias de validade para novos links e documentos.</small>
            </label>

            <label>
              <span>Lucro padrão das peças (% sobre a venda)</span>
              <input
                name="default_parts_margin_percent"
                type="number"
                min={0}
                max={99.99}
                step="0.01"
                defaultValue={30}
              />
              <small>
                % de lucro sobre a venda (não markup sobre o custo). Pode ser
                alterado depois em Configurações.
              </small>
            </label>
          </div>

          <label>
            <span>Observação padrão do orçamento</span>
            <textarea
              name="default_quote_notes"
              rows={4}
              maxLength={2000}
              placeholder="Ex.: Valores sujeitos à disponibilidade das peças."
            />
          </label>

          <div
            style={{
              padding: 14,
              border: "1px solid var(--orbiq-border)",
              borderRadius: 14,
            }}
          >
            <strong>Identidade visual</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Logo, cor e assinatura da marca podem ser personalizadas em
              Configurações assim que você entrar no painel.
            </p>
          </div>

          <button className="primary-button" type="submit">
            Concluir configuração e entrar no Orbiq
          </button>
        </form>
      </section>
    </main>
  );
}
