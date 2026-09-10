import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  login,
} from "./actions";


type PageProps = {

  searchParams?:
    Promise<
      Record<
        string,
        string |
        string[] |
        undefined
      >
    >;
};


function safeNext(
  raw:
    unknown,
): string {

  const value =
    typeof raw ===
    "string"
      ? raw
      : "";


  if (
    value.startsWith(
      "/convite/",
    ) &&
    !value.startsWith(
      "//",
    )
  ) {

    return value;
  }


  return "/dashboard";
}


export default async function LoginPage({
  searchParams,
}: PageProps) {

  const params =
    (
      await searchParams
    ) ??
    {};


  const next =
    safeNext(
      params.next,
    );


  const supabase =
    await createClient();


  const {
    data,
  } =
    await supabase.auth.getClaims();


  if (
    data?.claims
  ) {

    redirect(
      next,
    );
  }


  const error =
    typeof params.error ===
    "string"
      ? params.error
      : "";


  const message =
    typeof params.message ===
    "string"
      ? params.message
      : "";


  const signupHref =
    next !==
    "/dashboard"
      ? `/signup?next=${encodeURIComponent(
          next,
        )}`
      : "/signup";


  return (
    <main className="auth-shell">

      <section className="brand-panel">

        <div className="brand-lockup">

          <div className="brand-mark">
            <img src="/brand/orbiq-mark.png" alt="" width={32} height={32} />
          </div>

          <div>

            <strong>
              Orbiq
            </strong>

            <span>
              Operações automotivas
            </span>

          </div>

        </div>


        <div className="brand-copy">

          <span className="eyebrow">
            ACESSO PROFISSIONAL
          </span>

          <h1>
            Sua oficina conectada ao time inteiro.
          </h1>

          <p>
            Orçamentos, cotações, compras, execução e gestão da equipe em uma única operação.
          </p>

        </div>


        <small>
          Ambiente local de desenvolvimento
        </small>

      </section>


      <section className="auth-panel">

        <div className="auth-card">

          <span className="eyebrow red">
            ACESSO SEGURO
          </span>

          <h2>
            Entrar no Orbiq
          </h2>

          <p className="muted">
            {next.startsWith(
              "/convite/",
            )
              ? "Entre com o e-mail que recebeu o convite para continuar."
              : "Use seu e-mail e senha para acessar sua oficina."}
          </p>


          {message ? (
            <div className="notice success">
              {message}
            </div>
          ) : null}


          {error ? (
            <div className="notice error">
              {error}
            </div>
          ) : null}


          <form
            action={login}
            className="form-stack"
          >

            <input
              type="hidden"
              name="next"
              value={next}
            />


            <label>

              <span>
                E-mail
              </span>

              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@empresa.com.br"
              />

            </label>


            <label>

              <span>
                Senha
              </span>

              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                placeholder="Sua senha"
              />

            </label>


            <button
              className="primary-button"
              type="submit"
            >
              Entrar no Orbiq
            </button>

          </form>


          <p className="auth-footer">

            Ainda não tem conta?{" "}

            <Link
              href={signupHref}
            >
              Criar conta
            </Link>

          </p>

        </div>

      </section>

    </main>
  );
}