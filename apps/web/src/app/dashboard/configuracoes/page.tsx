import {
  loadWorkshopBranding,
  workshopLogoUrl,
} from "../../../lib/workshop-branding";

import {
  updateOrganizationSettingsAction,
} from "./actions";

import {
  requireCurrentPermission,
} from "../_lib/permissions";


type PageProps = {
  searchParams:
    Promise<{
      saved?: string;
      error?: string;
    }>;
};


export default async function SettingsPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const {
    supabase,
    organization,
  } =
    await requireCurrentPermission(
      "settings.manage",
    );

  const [
    organizationResult,
    settingsResult,
    branding,
  ] =
    await Promise.all([
      supabase
        .from("organizations")
        .select(
          "id, name, slug, cnpj, plan",
        )
        .eq(
          "id",
          organization.id,
        )
        .single(),

      supabase
        .from("organization_settings")
        .select(
          `
            organization_id,
            legal_name,
            phone,
            whatsapp,
            email,
            postal_code,
            address_line,
            address_number,
            address_complement,
            district,
            city,
            state,
            quote_validity_days,
            default_parts_margin_percent,
            default_quote_notes
          `,
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .single(),

      loadWorkshopBranding(
        organization.id,
      ),
    ]);

  if (
    organizationResult.error ||
    !organizationResult.data
  ) {
    throw new Error(
      `Falha ao carregar a oficina: ${
        organizationResult.error?.message ??
        "registro não encontrado"
      }`,
    );
  }

  if (
    settingsResult.error ||
    !settingsResult.data
  ) {
    throw new Error(
      `Falha ao carregar as configurações: ${
        settingsResult.error?.message ??
        "registro não encontrado"
      }`,
    );
  }

  const company =
    organizationResult.data;

  const settings =
    settingsResult.data;

  const logoUrl =
    workshopLogoUrl(
      branding.logoPath,
    );

  return (
    <div className="orbiq-page">

      <div className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">
            CONFIGURAÇÕES
          </span>

          <h1>
            Configurações da oficina
          </h1>

          <p>
            Dados da empresa, identidade visual e padrões utilizados
            na operação comercial do Orbiq.
          </p>
        </div>
      </div>

      {params.saved === "1" ? (
        <div className="orbiq-alert success">
          Configurações salvas com sucesso.
        </div>
      ) : null}

      {params.error ? (
        <div className="orbiq-alert error">
          Não foi possível salvar: {params.error}
        </div>
      ) : null}

      <form
        action={updateOrganizationSettingsAction}
        className="orbiq-form"
      >

        <div className="orbiq-grid-2">

          <section className="orbiq-panel">
            <span className="orbiq-eyebrow">
              EMPRESA
            </span>

            <h2>
              Dados da oficina
            </h2>

            <div className="orbiq-form">
              <label>
                <span>
                  NOME DA OFICINA
                </span>

                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={company.name}
                />
              </label>

              <label>
                <span>
                  RAZÃO SOCIAL
                </span>

                <input
                  name="legal_name"
                  maxLength={160}
                  defaultValue={
                    settings.legal_name ?? ""
                  }
                />
              </label>

              <label>
                <span>
                  CNPJ
                </span>

                <input
                  name="cnpj"
                  maxLength={32}
                  defaultValue={
                    company.cnpj ?? ""
                  }
                  placeholder="00.000.000/0000-00"
                />
              </label>

              <label>
                <span>
                  IDENTIFICADOR
                </span>

                <input
                  value={company.slug}
                  disabled
                />
              </label>

              <label>
                <span>
                  PLANO
                </span>

                <input
                  value={company.plan}
                  disabled
                />
              </label>
            </div>
          </section>

          <section className="orbiq-panel">
            <span className="orbiq-eyebrow">
              CONTATO
            </span>

            <h2>
              Canais da oficina
            </h2>

            <div className="orbiq-form">
              <label>
                <span>
                  TELEFONE
                </span>

                <input
                  name="phone"
                  defaultValue={
                    settings.phone ?? ""
                  }
                  placeholder="(00) 0000-0000"
                />
              </label>

              <label>
                <span>
                  WHATSAPP
                </span>

                <input
                  name="whatsapp"
                  defaultValue={
                    settings.whatsapp ?? ""
                  }
                  placeholder="(00) 00000-0000"
                />
              </label>

              <label>
                <span>
                  E-MAIL
                </span>

                <input
                  name="email"
                  type="email"
                  defaultValue={
                    settings.email ?? ""
                  }
                  placeholder="contato@oficina.com.br"
                />
              </label>
            </div>
          </section>

        </div>

        <section className="orbiq-panel">
          <span className="orbiq-eyebrow">
            IDENTIDADE VISUAL
          </span>

          <h2>
            Marca da oficina
          </h2>

          <p
            style={{
              margin: "6px 0 18px",
              color: "var(--orbiq-muted)",
              fontSize: 11,
              lineHeight: 1.6,
            }}
          >
            Esta identidade aparece na versão do cliente, no PDF e
            no link público do orçamento. O Orbiq permanece identificado
            discretamente como plataforma responsável pelo documento.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 240px) minmax(0, 1fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <span
                style={{
                  color: "var(--orbiq-muted)",
                  fontSize: 10,
                  fontWeight: 750,
                }}
              >
                PRÉ-VISUALIZAÇÃO
              </span>

              <div
                data-testid="settings-logo-preview"
                aria-label="Pré-visualização da marca"
                style={{
                  width: 112,
                  height: 112,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid var(--orbiq-border)",
                  borderRadius: 20,
                  backgroundColor: logoUrl
                    ? "#ffffff"
                    : branding.primaryColor,
                  backgroundImage: logoUrl
                    ? `url("${logoUrl}")`
                    : undefined,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "contain",
                  color: "#ffffff",
                  fontSize: 38,
                  fontWeight: 900,
                  overflow: "hidden",
                }}
              >
                {logoUrl ? null : "O"}
              </div>

              <strong>
                {company.name}
              </strong>

              <span
                style={{
                  color: "var(--orbiq-muted)",
                  fontSize: 10,
                }}
              >
                {branding.tagline ??
                  "Sua oficina, sua identidade."}
              </span>
            </div>

            <div className="orbiq-form">
              <label>
                <span>
                  LOGO DA OFICINA
                </span>

                <input
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                />

                <small
                  style={{
                    color: "var(--orbiq-muted)",
                    fontSize: 9,
                    lineHeight: 1.5,
                  }}
                >
                  PNG, JPG/JPEG ou WebP. Máximo de 2 MB.
                  SVG não é aceito por segurança.
                </small>
              </label>

              <label>
                <span>
                  COR PRINCIPAL
                </span>

                <input
                  name="brand_primary_color"
                  type="color"
                  required
                  defaultValue={
                    branding.primaryColor
                  }
                  aria-label="Cor principal da marca"
                />
              </label>

              <label>
                <span>
                  ASSINATURA DA MARCA
                </span>

                <input
                  name="brand_tagline"
                  maxLength={120}
                  defaultValue={
                    branding.tagline ?? ""
                  }
                  placeholder="Ex.: Confiança para seguir em frente"
                />
              </label>

              {branding.logoPath ? (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  <input
                    name="remove_logo"
                    type="checkbox"
                    value="1"
                    style={{
                      width: 16,
                      height: 16,
                      minHeight: 16,
                    }}
                  />

                  <span>
                    REMOVER LOGO ATUAL
                  </span>
                </label>
              ) : null}
            </div>
          </div>
        </section>

        <section className="orbiq-panel">
          <span className="orbiq-eyebrow">
            ENDEREÇO
          </span>

          <h2>
            Localização da oficina
          </h2>

          <div className="orbiq-form">
            <div className="orbiq-form-row">
              <label>
                <span>
                  CEP
                </span>

                <input
                  name="postal_code"
                  defaultValue={
                    settings.postal_code ?? ""
                  }
                  placeholder="00000-000"
                />
              </label>

              <label>
                <span>
                  LOGRADOURO
                </span>

                <input
                  name="address_line"
                  defaultValue={
                    settings.address_line ?? ""
                  }
                  placeholder="Rua / Avenida"
                />
              </label>
            </div>

            <div className="orbiq-form-row">
              <label>
                <span>
                  NÚMERO
                </span>

                <input
                  name="address_number"
                  defaultValue={
                    settings.address_number ?? ""
                  }
                />
              </label>

              <label>
                <span>
                  COMPLEMENTO
                </span>

                <input
                  name="address_complement"
                  defaultValue={
                    settings.address_complement ?? ""
                  }
                />
              </label>
            </div>

            <div className="orbiq-form-row">
              <label>
                <span>
                  BAIRRO
                </span>

                <input
                  name="district"
                  defaultValue={
                    settings.district ?? ""
                  }
                />
              </label>

              <label>
                <span>
                  CIDADE
                </span>

                <input
                  name="city"
                  defaultValue={
                    settings.city ?? ""
                  }
                />
              </label>
            </div>

            <label>
              <span>
                UF
              </span>

              <input
                name="state"
                minLength={2}
                maxLength={2}
                defaultValue={
                  settings.state ?? ""
                }
                placeholder="MG"
              />
            </label>
          </div>
        </section>

        <section className="orbiq-panel">
          <span className="orbiq-eyebrow">
            PADRÕES COMERCIAIS
          </span>

          <h2>
            Orçamentos
          </h2>

          <div className="orbiq-form">
            <div className="orbiq-form-row">
              <label>
                <span>
                  VALIDADE PADRÃO
                </span>

                <input
                  name="quote_validity_days"
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  defaultValue={
                    settings.quote_validity_days
                  }
                />
              </label>

              <label>
                <span>
                  MARGEM PADRÃO DAS PEÇAS (%)
                </span>

                <input
                  name="default_parts_margin_percent"
                  type="number"
                  min={0}
                  max={1000}
                  step="0.01"
                  defaultValue={
                    settings.default_parts_margin_percent
                  }
                />
              </label>
            </div>

            <label>
              <span>
                OBSERVAÇÃO PADRÃO
              </span>

              <textarea
                name="default_quote_notes"
                rows={5}
                maxLength={2000}
                defaultValue={
                  settings.default_quote_notes ?? ""
                }
                placeholder="Mensagem padrão exibida nos orçamentos."
              />
            </label>
          </div>
        </section>

        <div>
          <button
            type="submit"
            className="orbiq-primary-button"
          >
            Salvar configurações
          </button>
        </div>

      </form>

    </div>
  );
}
