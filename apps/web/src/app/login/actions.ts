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
        "E-mail ou senha inválidos.",
        next,
      ),
    );
  }


  redirect(
    next,
  );
}