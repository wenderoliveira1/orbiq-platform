import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createPublicSupabaseClient,
} from "../../../lib/supabase/public";

import {
  acceptInviteAction,
  leaveInviteSessionAction,
} from "./actions";


type PageProps = {

  params:
    Promise<{
      token: string;
    }>;

  searchParams:
    Promise<{
      error?: string;
    }>;
};


type InviteInfo = {

  organization_name:
    string;

  email:
    string;

  role:
    string;

  expires_at:
    string;

  state:
    string;
};


const roleLabels:
  Record<
    string,
    string
  > = {

  admin:
    "Administrador",

  manager:
    "Gerente",

  estimator:
    "Orçamentista",

  technician:
    "Técnico",

  viewer:
    "Somente leitura",
};


function date(
  value:
    string,
): string {

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


export default async function InvitePage({
  params,
  searchParams,
}: PageProps) {

  const {
    token,
  } =
    await params;


  const query =
    await searchParams;


  const publicSupabase =
    createPublicSupabaseClient();


  const {
    data: inviteData,
    error: inviteError,
  } =
    await publicSupabase.rpc(
      "public_get_organization_invite",
      {
        target_token:
          token,
      },
    );


  if (
    inviteError ||
    !inviteData
  ) {

    notFound();
  }


  const invitation =
    inviteData as unknown as InviteInfo;


  const supabase =
    await createClient();


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();


  const currentEmail =
    user?.email?.toLowerCase() ??
    null;


  const expectedEmail =
    invitation.email.toLowerCase();


  const correctUser =
    Boolean(
      currentEmail &&
      currentEmail ===
        expectedEmail,
    );


  const next =
    `/convite/${token}`;


  const loginHref =
    `/login?next=${encodeURIComponent(
      next,
    )}`;


  const signupHref =
    `/signup?next=${encodeURIComponent(
      next,
    )}`;


  const stateMessages:
    Record<
      string,
      {
        title: string;
        description: string;
      }
    > = {

    accepted: {
      title:
        "Convite já utilizado",

      description:
        "Este acesso já foi aceito por um usuário.",
    },

    revoked: {
      title:
        "Convite revogado",

      description:
        "A oficina cancelou este convite.",
    },

    expired: {
      title:
        "Convite expirado",

      description:
        "Peça ao responsável pela oficina para gerar um novo convite.",
    },
  };


  if (
    invitation.state !==
    "pending"
  ) {

    const state =
      stateMessages[
        invitation.state
      ] ?? {
        title:
          "Convite indisponível",

        description:
          "Este convite não pode mais ser utilizado.",
      };


    return (
      <main className="invite-shell">

        <section className="invite-card">

          <div className="invite-brand">

            <span>
              O
            </span>

            <strong>
              ORBIQ
            </strong>

          </div>


          <span className="invite-eyebrow">
            CONVITE DE EQUIPE
          </span>


          <h1>
            {state.title}
          </h1>


          <p>
            {state.description}
          </p>


          <Link
            href="/login"
            className="invite-secondary"
          >
            Ir para o login
          </Link>

        </section>

      </main>
    );
  }


  return (
    <main className="invite-shell">

      <section className="invite-card">

        <div className="invite-brand">

          <span>
            O
          </span>

          <strong>
            ORBIQ
          </strong>

        </div>


        <span className="invite-eyebrow">
          CONVITE DE EQUIPE
        </span>


        <h1>
          Você foi convidado para a {invitation.organization_name}
        </h1>


        <p>
          Entre no Orbiq para fazer parte da operação desta oficina.
        </p>


        <div className="invite-details">

          <div>

            <span>
              E-MAIL
            </span>

            <strong>
              {invitation.email}
            </strong>

          </div>


          <div>

            <span>
              CARGO
            </span>

            <strong>
              {roleLabels[
                invitation.role
              ] ??
              invitation.role}
            </strong>

          </div>


          <div>

            <span>
              VÁLIDO ATÉ
            </span>

            <strong>
              {date(
                invitation.expires_at,
              )}
            </strong>

          </div>

        </div>


        {query.error ? (

          <div className="invite-error">
            {query.error}
          </div>

        ) : null}


        {!user ? (

          <div className="invite-actions">

            <Link
              href={loginHref}
              className="invite-primary"
            >
              Já tenho conta
            </Link>


            <Link
              href={signupHref}
              className="invite-secondary"
            >
              Criar minha conta
            </Link>

          </div>

        ) : correctUser ? (

          <form
            action={acceptInviteAction}
            className="invite-actions"
          >

            <input
              type="hidden"
              name="token"
              value={token}
            />


            <button
              type="submit"
              className="invite-primary"
            >
              Aceitar convite e entrar
            </button>

          </form>

        ) : (

          <div className="invite-wrong-user">

            <strong>
              Você está conectado com outro e-mail.
            </strong>

            <span>
              Conta atual: {user.email}
            </span>

            <span>
              Convite destinado a: {invitation.email}
            </span>


            <form
              action={leaveInviteSessionAction}
            >

              <input
                type="hidden"
                name="token"
                value={token}
              />


              <button
                type="submit"
                className="invite-secondary"
              >
                Sair e entrar com o e-mail correto
              </button>

            </form>

          </div>

        )}


        <small className="invite-security">
          Este convite possui token individual e expira automaticamente.
        </small>

      </section>

    </main>
  );
}