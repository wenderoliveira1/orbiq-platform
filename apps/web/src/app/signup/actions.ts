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


  return "/onboarding";
}


function signupErrorUrl(
  message:
    string,

  next:
    string,
): string {

  return (
    "/signup?error=" +
    encodeURIComponent(
      message,
    ) +
    (
      next !==
      "/onboarding"
        ? "&next=" +
          encodeURIComponent(
            next,
          )
        : ""
    )
  );
}


export async function signup(
  formData:
    FormData,
): Promise<never> {

  const name =
    String(
      formData.get(
        "name",
      ) ??
      "",
    ).trim();


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
    name.length <
    2
  ) {

    redirect(
      signupErrorUrl(
        "Informe seu nome.",
        next,
      ),
    );
  }


  if (
    !email ||
    password.length <
    6
  ) {

    redirect(
      signupErrorUrl(
        "Informe um e-mail válido e senha com pelo menos 6 caracteres.",
        next,
      ),
    );
  }


  const supabase =
    await createClient();


  const {
    data,
    error,
  } =
    await supabase.auth.signUp({

      email,

      password,

      options: {

        data: {
          full_name:
            name,
        },
      },
    });


  if (error) {

    redirect(
      signupErrorUrl(
        error.message,
        next,
      ),
    );
  }


  if (
    !data.session
  ) {

    const loginNext =
      next !==
      "/onboarding"
        ? "&next=" +
          encodeURIComponent(
            next,
          )
        : "";


    redirect(
      "/login?message=" +
      encodeURIComponent(
        "Conta criada. Confirme seu e-mail para continuar.",
      ) +
      loginNext,
    );
  }


  redirect(
    next,
  );
}