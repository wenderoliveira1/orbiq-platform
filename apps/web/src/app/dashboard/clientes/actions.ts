"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentContext } from "../_lib/current-organization";

function text(
  value: FormDataEntryValue | null,
) {
  return String(value ?? "").trim();
}

function optional(
  value: FormDataEntryValue | null,
) {
  const result = text(value);

  return result.length
    ? result
    : null;
}

function customersUrl(
  kind: "ok" | "error",
  message: string,
) {
  return `/dashboard/clientes?${kind}=${encodeURIComponent(
    message,
  )}`;
}

export async function createCustomerAction(
  formData: FormData,
) {
  const {
    supabase,
    organization,
    user,
  } = await getCurrentContext();

  const name = text(
    formData.get("name"),
  );

  const phone = optional(
    formData.get("phone"),
  );

  const email = optional(
    formData.get("email"),
  );

  const notes = optional(
    formData.get("notes"),
  );

  if (name.length < 2) {
    redirect(
      customersUrl(
        "error",
        "Informe o nome e sobrenome do cliente.",
      ),
    );
  }

  const { error } =
    await supabase
      .from("customers")
      .insert({
        organization_id:
          organization.id,

        name,
        phone,
        email,
        notes,

        created_by:
          user.id,
      });

  if (error) {
    redirect(
      customersUrl(
        "error",
        `Não foi possível cadastrar: ${error.message}`,
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clientes");

  redirect(
    customersUrl(
      "ok",
      "Cliente cadastrado com sucesso.",
    ),
  );
}

export async function updateCustomerAction(
  formData: FormData,
) {
  const {
    supabase,
    organization,
  } = await getCurrentContext();

  const id =
    text(
      formData.get("id"),
    );

  const name =
    text(
      formData.get("name"),
    );

  const phone =
    optional(
      formData.get("phone"),
    );

  const email =
    optional(
      formData.get("email"),
    );

  const notes =
    optional(
      formData.get("notes"),
    );

  if (!id) {
    redirect(
      customersUrl(
        "error",
        "Cliente inválido.",
      ),
    );
  }

  if (name.length < 2) {
    redirect(
      customersUrl(
        "error",
        "Informe o nome e sobrenome do cliente.",
      ),
    );
  }

  const { error } =
    await supabase
      .from("customers")
      .update({
        name,
        phone,
        email,
        notes,
      })
      .eq("id", id)
      .eq(
        "organization_id",
        organization.id,
      );

  if (error) {
    redirect(
      customersUrl(
        "error",
        `Não foi possível atualizar: ${error.message}`,
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clientes");
  revalidatePath("/dashboard/veiculos");

  redirect(
    customersUrl(
      "ok",
      "Cliente atualizado.",
    ),
  );
}