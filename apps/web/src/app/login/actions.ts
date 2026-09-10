"use server";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";


function safeNext(
  value:
    FormDataEntryValue |
    null,
): string {

  const next =
    String(
      value ??
      "",
    ).trim();


  if (
    next.startsWith(
      "/convite/",
    ) &&
    !next.startsWith(
      "//",
    )
  ) {

    return next;
  }


  return "/dashboard";
}


function loginUrl(
  message:
    string,

  next:
    string,
): string {

  return (
    "/login?error=" +
    encodeURIComponent(
      message,
    ) +
    (
      next !==
      "/dashboard"
        ? "&next=" +
          encodeURIComponent(
            next,
          )
        : ""
    )
  );
}


function loginErrorMessage(
  error: {
    code?: string;
    message?: string;
    status?: number;
  },
): string {

  const code =
    (
      error.code ??
      ""
    ).toLowerCase();

  const message =
    (
      error.message ??
      ""
    ).toLowerCase();


  if (
    code ===
      "email_not_confirmed" ||
    message.includes(
      "email not confirmed",
    )
  ) {

    return "Confirme seu e-mail antes de entrar.";
  }


  if (
    code ===
      "over_request_rate_limit" ||
    code ===
      "over_email_send_rate_limit" ||
    message.includes(
      "rate limit",
    ) ||
    message.includes(
      "too many requests",
    )
  ) {

    return "Muitas tentativas. Aguarde um momento e tente de novo.";
  }


  if (
    message.includes(
      "failed to fetch",
    ) ||
    message.includes(
      "network",
    ) ||
    message.includes(
      "fetch failed",
    )
  ) {

    return "Não foi possível conectar. Verifique sua conexão e tente de novo.";
  }


  return "E-mail ou senha inválidos.";
}


export async function login(
  formData:
    FormData,
): Promise<never> {

  const email =
    String(
      formData.get(
        "email",
      ) ??
      "",
    ).trim();


  const password =
    String(
      formData.get(
        "password",
      ) ??
      "",
    );


  const next =
    safeNext(
      formData.get(
        "next",
      ),
    );


  if (
    !email ||
    !password
  ) {

    redirect(
      loginUrl(
        "Informe e-mail e senha.",
        next,
      ),
    );
  }


  const supabase =
    await createClient();


  const {
    error,
  } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });


  if (error) {

    redirect(
      loginUrl(
        loginErrorMessage(
          error,
        ),
        next,
      ),
    );
  }


  redirect(
    next,
  );
}
