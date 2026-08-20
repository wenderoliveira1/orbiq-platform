import {
  getCurrentContext,
} from "../../_lib/current-organization";

import {
  QuoteForm,
} from "./quote-form";


type SearchParams =
  Promise<{
    error?: string;
    created?: string;
  }>;


export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params =
    await searchParams;


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const [
    customersResult,
    vehiclesResult,
  ] =
    await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, name, phone",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .order(
          "name",
          {
            ascending: true,
          },
        ),

      supabase
        .from("vehicles")
        .select(
          "id, customer_id, plate, brand, model, version, mileage",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .order(
          "plate",
          {
            ascending: true,
          },
        ),
    ]);


  if (
    customersResult.error
  ) {
    throw new Error(
      `Falha ao carregar clientes: ${customersResult.error.message}`,
    );
  }


  if (
    vehiclesResult.error
  ) {
    throw new Error(
      `Falha ao carregar veículos: ${vehiclesResult.error.message}`,
    );
  }


  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <span className="orbiq-eyebrow">
            NOVO ORÇAMENTO
          </span>

          <h1>
            Atendimento rápido
          </h1>

          <p>
            Cliente, veículo, serviços e peças em um único fluxo.
          </p>
        </div>
      </section>


      {params.error ? (
        <div className="orbiq-alert error">
          {params.error}
        </div>
      ) : null}


      {params.created ? (
        <div className="orbiq-created-banner">
          <div>
            <span className="orbiq-eyebrow">
              ORÇAMENTO SALVO
            </span>

            <strong>
              {params.created}
            </strong>

            <span>
              O formulário já está pronto para um novo atendimento.
            </span>
          </div>

          <a
            href="/dashboard/orcamentos/novo"
            className="orbiq-secondary-button"
          >
            Realizar novo orçamento
          </a>
        </div>
      ) : null}


      <QuoteForm
        customers={
          customersResult.data ??
          []
        }
        vehicles={
          vehiclesResult.data ??
          []
        }
      />
    </div>
  );
}