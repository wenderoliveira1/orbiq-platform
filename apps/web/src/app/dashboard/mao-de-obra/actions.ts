"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  getCurrentContext,
} from "../_lib/current-organization";


function text(
  value:
    FormDataEntryValue |
    null,
): string {

  return String(
    value ??
      "",
  ).trim();
}


function parseMoney(
  raw:
    string,
): number | null {

  let value =
    raw
      .trim()
      .replace(
        /\s/g,
        "",
      );


  if (!value) {

    return null;
  }


  if (
    value.includes(
      ",",
    )
  ) {

    value =
      value
        .replace(
          /\./g,
          "",
        )
        .replace(
          ",",
          ".",
        );
  }


  const parsed =
    Number(
      value,
    );


  if (
    !Number.isFinite(
      parsed,
    )
  ) {

    return null;
  }


  return parsed;
}


function url(
  type:
    "ok" |
    "error",

  message:
    string,
): string {

  return (
    "/dashboard/mao-de-obra?" +
    type +
    "=" +
    encodeURIComponent(
      message,
    )
  );
}


export async function saveLaborServiceAction(
  formData:
    FormData,
): Promise<never> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const serviceId =
    text(
      formData.get(
        "service_id",
      ),
    ) ||
    null;


  const description =
    text(
      formData.get(
        "description",
      ),
    );


  const category =
    text(
      formData.get(
        "category",
      ),
    );


  const notes =
    text(
      formData.get(
        "notes",
      ),
    );


  const amount =
    parseMoney(
      text(
        formData.get(
          "amount",
        ),
      ),
    );


  if (
    description.length <
    2
  ) {

    redirect(
      url(
        "error",
        "Informe o nome do serviço.",
      ),
    );
  }


  if (
    amount ===
      null ||
    amount <
      0
  ) {

    redirect(
      url(
        "error",
        "Informe um valor válido para a mão de obra.",
      ),
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "save_labor_service",
      {
        target_org_id:
          organization.id,

        target_service_id:
          serviceId,

        target_description:
          description,

        target_category:
          category ||
          null,

        target_amount:
          amount,

        target_notes:
          notes ||
          null,
      },
    );


  if (error) {

    const message =
      error.message.includes(
        "already exists",
      )
        ? "Esse serviço já está cadastrado nessa categoria."
        : `Não foi possível salvar: ${error.message}`;


    redirect(
      url(
        "error",
        message,
      ),
    );
  }


  revalidatePath(
    "/dashboard",
  );


  revalidatePath(
    "/dashboard/mao-de-obra",
  );


  redirect(
    url(
      "ok",
      serviceId
        ? "Mão de obra atualizada."
        : "Mão de obra adicionada.",
    ),
  );
}


export async function toggleLaborServiceAction(
  formData:
    FormData,
): Promise<never> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const serviceId =
    text(
      formData.get(
        "service_id",
      ),
    );


  const active =
    text(
      formData.get(
        "target_active",
      ),
    ) ===
    "true";


  if (!serviceId) {

    redirect(
      url(
        "error",
        "Serviço inválido.",
      ),
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "set_labor_service_active",
      {
        target_org_id:
          organization.id,

        target_service_id:
          serviceId,

        target_active:
          active,
      },
    );


  if (error) {

    redirect(
      url(
        "error",
        `Não foi possível alterar o serviço: ${error.message}`,
      ),
    );
  }


  revalidatePath(
    "/dashboard/mao-de-obra",
  );


  redirect(
    url(
      "ok",
      active
        ? "Serviço ativado."
        : "Serviço desativado.",
    ),
  );
}