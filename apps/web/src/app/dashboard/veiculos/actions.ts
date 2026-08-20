"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentContext } from "../_lib/current-organization";

function text(
  value: FormDataEntryValue | null,
) {
  return String(
    value ?? "",
  ).trim();
}

function optional(
  value: FormDataEntryValue | null,
) {
  const result =
    text(value);

  return result.length
    ? result
    : null;
}

function normalizePlate(
  value: FormDataEntryValue | null,
) {
  return text(value)
    .replace(
      /[^a-zA-Z0-9]/g,
      "",
    )
    .toUpperCase();
}

function optionalNumber(
  value: FormDataEntryValue | null,
) {
  const raw =
    text(value);

  if (!raw) {
    return null;
  }

  const parsed =
    Number(raw);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function vehiclesUrl(
  kind: "ok" | "error",
  message: string,
) {
  return `/dashboard/veiculos?${kind}=${encodeURIComponent(
    message,
  )}`;
}

export async function createVehicleAction(
  formData: FormData,
) {
  const {
    supabase,
    organization,
  } = await getCurrentContext();

  const customerId =
    text(
      formData.get(
        "customer_id",
      ),
    );

  const plate =
    normalizePlate(
      formData.get(
        "plate",
      ),
    );

  const brand =
    optional(
      formData.get(
        "brand",
      ),
    );

  const model =
    text(
      formData.get(
        "model",
      ),
    );

  const version =
    optional(
      formData.get(
        "version",
      ),
    );

  const modelYear =
    optionalNumber(
      formData.get(
        "model_year",
      ),
    );

  const mileage =
    optionalNumber(
      formData.get(
        "mileage",
      ),
    );

  const notes =
    optional(
      formData.get(
        "notes",
      ),
    );

  if (!customerId) {
    redirect(
      vehiclesUrl(
        "error",
        "Selecione o cliente proprietário.",
      ),
    );
  }

  const {
    data: customer,
  } =
    await supabase
      .from("customers")
      .select("id")
      .eq(
        "id",
        customerId,
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .maybeSingle();

  if (!customer) {
    redirect(
      vehiclesUrl(
        "error",
        "O cliente selecionado não pertence à oficina.",
      ),
    );
  }

  if (plate.length !== 7) {
    redirect(
      vehiclesUrl(
        "error",
        "Informe uma placa válida com 7 caracteres.",
      ),
    );
  }

  if (model.length < 2) {
    redirect(
      vehiclesUrl(
        "error",
        "Informe o modelo do veículo.",
      ),
    );
  }

  if (
    modelYear !== null &&
    (
      modelYear < 1900 ||
      modelYear > 2100
    )
  ) {
    redirect(
      vehiclesUrl(
        "error",
        "Ano do modelo inválido.",
      ),
    );
  }

  if (
    mileage !== null &&
    mileage < 0
  ) {
    redirect(
      vehiclesUrl(
        "error",
        "Quilometragem inválida.",
      ),
    );
  }

  const { error } =
    await supabase
      .from("vehicles")
      .insert({
        organization_id:
          organization.id,

        customer_id:
          customerId,

        plate,
        brand,
        model,
        version,

        model_year:
          modelYear,

        mileage,
        notes,
      });

  if (error) {
    const message =
      error.code === "23505"
        ? "Essa placa já está cadastrada nesta oficina."
        : `Não foi possível cadastrar: ${error.message}`;

    redirect(
      vehiclesUrl(
        "error",
        message,
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/veiculos");

  redirect(
    vehiclesUrl(
      "ok",
      "Veículo cadastrado com sucesso.",
    ),
  );
}

export async function updateVehicleAction(
  formData: FormData,
) {
  const {
    supabase,
    organization,
  } = await getCurrentContext();

  const id =
    text(
      formData.get(
        "id",
      ),
    );

  const customerId =
    text(
      formData.get(
        "customer_id",
      ),
    );

  const plate =
    normalizePlate(
      formData.get(
        "plate",
      ),
    );

  const brand =
    optional(
      formData.get(
        "brand",
      ),
    );

  const model =
    text(
      formData.get(
        "model",
      ),
    );

  const version =
    optional(
      formData.get(
        "version",
      ),
    );

  const modelYear =
    optionalNumber(
      formData.get(
        "model_year",
      ),
    );

  const mileage =
    optionalNumber(
      formData.get(
        "mileage",
      ),
    );

  const notes =
    optional(
      formData.get(
        "notes",
      ),
    );

  if (!id) {
    redirect(
      vehiclesUrl(
        "error",
        "Veículo inválido.",
      ),
    );
  }

  if (!customerId) {
    redirect(
      vehiclesUrl(
        "error",
        "Selecione o cliente proprietário.",
      ),
    );
  }

  const {
    data: customer,
  } =
    await supabase
      .from("customers")
      .select("id")
      .eq(
        "id",
        customerId,
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .maybeSingle();

  if (!customer) {
    redirect(
      vehiclesUrl(
        "error",
        "O cliente selecionado não pertence à oficina.",
      ),
    );
  }

  if (plate.length !== 7) {
    redirect(
      vehiclesUrl(
        "error",
        "Informe uma placa válida com 7 caracteres.",
      ),
    );
  }

  if (model.length < 2) {
    redirect(
      vehiclesUrl(
        "error",
        "Informe o modelo do veículo.",
      ),
    );
  }

  if (
    modelYear !== null &&
    (
      modelYear < 1900 ||
      modelYear > 2100
    )
  ) {
    redirect(
      vehiclesUrl(
        "error",
        "Ano do modelo inválido.",
      ),
    );
  }

  if (
    mileage !== null &&
    mileage < 0
  ) {
    redirect(
      vehiclesUrl(
        "error",
        "Quilometragem inválida.",
      ),
    );
  }

  const { error } =
    await supabase
      .from("vehicles")
      .update({
        customer_id:
          customerId,

        plate,
        brand,
        model,
        version,

        model_year:
          modelYear,

        mileage,
        notes,
      })
      .eq(
        "id",
        id,
      )
      .eq(
        "organization_id",
        organization.id,
      );

  if (error) {
    const message =
      error.code === "23505"
        ? "Essa placa já está cadastrada nesta oficina."
        : `Não foi possível atualizar: ${error.message}`;

    redirect(
      vehiclesUrl(
        "error",
        message,
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/veiculos");

  redirect(
    vehiclesUrl(
      "ok",
      "Veículo atualizado.",
    ),
  );
}