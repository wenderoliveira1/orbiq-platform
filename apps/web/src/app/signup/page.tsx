import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  signup,
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


  return "/onboarding";
}


export default async function SignupPage({
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


  const invitation =
    next.startsWith(
      "/convite/",
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
      invitation
        ? next
        : "/dashboard",
    );
  }


  const error =
    typeof params.error ===
    "string"
      ? params.error
      : "";


  const loginHref =
    invitation
      ? `/login?next=${encodeURIComponent(
          next,
        )}`
      : "/login";


  return (
    <main className="auth-shell single">

      <section className="auth-panel">

        <div className="auth-card">

          <div className="mobile-brand">

            <div className="brand-mark">
              O
            </div>

            <div>

              <strong>
                Orbiq
              </strong>

              <span>
                Automotive Operations Platform
              </span>

            </div>

          </div>


          <span className="eyebrow red">
            {invitation
              ? "CONVITE DA EQUIPE"
              : "PRIMEIRO ACESSO"}
          </span>


          <h2>
            Criar sua conta
          </h2>


          <p className="muted">
            {invitation
              ? "Crie sua conta com o mesmo e-mail que recebeu o convite. Depois você entrará diretamente na oficina."
              : "Este usuário será o proprietário da primeira oficina cadastrada."}
          </p>


          {error ? (
            <div className="notice error">
              {error}
            </div>
          ) : null}


          <form
            action={signup}
            className="form-stack"
          >

            <input
              type="hidden"
              name="next"
              value={next}
            />


            <label>

              <span>
                Nome
              </span>

              <input
                name="name"
                required
                minLength={2}
                autoComplete="name"
                placeholder="Seu nome"
              />

            </label>


            <label>

              <span>
                E-mail
              </span>

              <input
                name="email"
                type="email"
                required
                autoComplete="email"
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
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
              />

            </label>


            <button
              className="primary-button"
              type="submit"
            >
              {invitation
                ? "Criar conta e continuar"
                : "Criar conta"}
            </button>

          </form>


          <p className="auth-footer">

            Já tem conta?{" "}

            <Link href={loginHref}>
              Voltar ao login
            </Link>

          </p>

        </div>

      </section>

    </main>
  );
}