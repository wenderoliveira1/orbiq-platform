import {
  updateOrganizationSettingsAction,
} from "./actions";

import {
  requireCurrentPermission,
} from "../_lib/permissions";


type PageProps = {

  searchParams:
    Promise<{
      saved?:
        string;

      error?:
        string;
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
  ] =
    await Promise.all([

      supabase
        .from(
          "organizations",
        )
        .select(
          "id, name, slug, cnpj, plan",
        )
        .eq(
          "id",
          organization.id,
        )
        .single(),

      supabase
        .from(
          "organization_settings",
        )
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
            Dados da empresa e padrões utilizados
            na operação comercial do Orbiq.
          </p>

        </div>

      </div>


      {params.saved ===
        "1" ? (

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
        action={
          updateOrganizationSettingsAction
        }
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
                  defaultValue={
                    company.name
                  }
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
                    settings.legal_name ??
                    ""
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
                    company.cnpj ??
                    ""
                  }
                  placeholder="00.000.000/0000-00"
                />

              </label>


              <label>

                <span>
                  IDENTIFICADOR
                </span>

                <input
                  value={
                    company.slug
                  }
                  disabled
                />

              </label>


              <label>

                <span>
                  PLANO
                </span>

                <input
                  value={
                    company.plan
                  }
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
                    settings.phone ??
                    ""
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
                    settings.whatsapp ??
                    ""
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
                    settings.email ??
                    ""
                  }
                  placeholder="contato@oficina.com.br"
                />

              </label>

            </div>

          </section>

        </div>


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
                    settings.postal_code ??
                    ""
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
                    settings.address_line ??
                    ""
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
                    settings.address_number ??
                    ""
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
                    settings.address_complement ??
                    ""
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
                    settings.district ??
                    ""
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
                    settings.city ??
                    ""
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
                  settings.state ??
                  ""
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
                  settings.default_quote_notes ??
                  ""
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