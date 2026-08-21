import Link from "next/link";


type PageProps = {

  searchParams:
    Promise<{
      permission?: string;
    }>;
};


export default async function AccessDeniedPage({
  searchParams,
}: PageProps) {

  const query =
    await searchParams;


  return (
    <div className="orbiq-page">

      <section className="orbiq-panel">

        <span className="orbiq-eyebrow">
          ACESSO RESTRITO
        </span>

        <h1>
          Você não possui permissão para acessar este módulo.
        </h1>

        <p className="orbiq-muted">
          O Orbiq bloqueou esta área de acordo com o cargo associado ao seu usuário.
        </p>


        {query.permission ? (

          <p className="orbiq-muted">
            Permissão necessária:{" "}
            <strong>
              {query.permission}
            </strong>
          </p>

        ) : null}


        <div>

          <Link
            href="/dashboard"
            className="orbiq-primary-button"
          >
            Voltar ao painel
          </Link>

        </div>

      </section>

    </div>
  );
}