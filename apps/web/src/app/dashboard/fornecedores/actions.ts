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
    value ?? "",
  ).trim();
}


function suppliersUrl(
  type:
    "ok" |
    "error",

  message:
    string,
): string {
  return (
    "/dashboard/fornecedores?" +
    type +
    "=" +
    encodeURIComponent(
      message,
    )
  );
}


function normalizeWhatsapp(
  value:
    string,
): string {
  return value.replace(
    /\D/g,
    "",
  );
}


export async function saveSupplierAction(
  formData:
    FormData,
): Promise<never> {
  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const supplierIdRaw =
    text(
      formData.get(
        "supplier_id",
      ),
    );


  const supplierId =
    supplierIdRaw ||
    null;


  const name =
    text(
      formData.get(
        "name",
      ),
    );


  const whatsapp =
    normalizeWhatsapp(
      text(
        formData.get(
          "whatsapp",
        ),
      ),
    );


  const notes =
    text(
      formData.get(
        "notes",
      ),
    );


  const categoryIds =
    formData
      .getAll(
        "category_ids",
      )
      .map(
        (value) =>
          String(
            value,
          ).trim(),
      )
      .filter(Boolean);


  if (
    name.length <
    2
  ) {
    redirect(
      suppliersUrl(
        "error",
        "Informe o nome do fornecedor.",
      ),
    );
  }


  if (
    whatsapp &&
    (
      whatsapp.length <
        10 ||
      whatsapp.length >
        15
    )
  ) {
    redirect(
      suppliersUrl(
        "error",
        "Informe o WhatsApp somente com DDI, DDD e número. Ex.: 5521999999999.",
      ),
    );
  }


  if (
    categoryIds.length ===
    0
  ) {
    redirect(
      suppliersUrl(
        "error",
        "Marque pelo menos uma categoria.",
      ),
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "save_supplier",
      {
        target_org_id:
          organization.id,

        target_supplier_id:
          supplierId,

        target_name:
          name,

        target_whatsapp:
          whatsapp ||
          null,

        target_notes:
          notes ||
          null,

        target_category_ids:
          categoryIds,
      },
    );


  if (error) {
    redirect(
      suppliersUrl(
        "error",
        `Não foi possível salvar o fornecedor: ${error.message}`,
      ),
    );
  }


  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/fornecedores",
  );


  redirect(
    suppliersUrl(
      "ok",
      supplierId
        ? "Fornecedor atualizado."
        : "Fornecedor cadastrado.",
    ),
  );
}


export async function toggleSupplierAction(
  formData:
    FormData,
): Promise<never> {
  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const supplierId =
    text(
      formData.get(
        "supplier_id",
      ),
    );


  const targetActive =
    text(
      formData.get(
        "target_active",
      ),
    ) ===
    "true";


  if (!supplierId) {
    redirect(
      suppliersUrl(
        "error",
        "Fornecedor inválido.",
      ),
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "set_supplier_active",
      {
        target_org_id:
          organization.id,

        target_supplier_id:
          supplierId,

        target_active:
          targetActive,
      },
    );


  if (error) {
    redirect(
      suppliersUrl(
        "error",
        `Não foi possível alterar o fornecedor: ${error.message}`,
      ),
    );
  }


  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/fornecedores",
  );


  redirect(
    suppliersUrl(
      "ok",
      targetActive
        ? "Fornecedor ativado."
        : "Fornecedor desativado.",
    ),
  );
}