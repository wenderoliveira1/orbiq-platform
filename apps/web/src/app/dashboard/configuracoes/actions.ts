"use server";


import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  requireCurrentPermission,
} from "../_lib/permissions";


function text(
  formData:
    FormData,

  field:
    string,
): string {

  return String(
    formData.get(
      field,
    ) ??
    "",
  ).trim();
}


function optionalText(
  formData:
    FormData,

  field:
    string,
): string | null {

  const value =
    text(
      formData,
      field,
    );


  return value ||
    null;
}


function numericValue(
  formData:
    FormData,

  field:
    string,

  fallback:
    number,
): number {

  const value =
    text(
      formData,
      field,
    )
      .replace(
        ",",
        ".",
      );


  if (!value) {

    return fallback;
  }


  const number =
    Number(
      value,
    );


  if (
    !Number.isFinite(
      number,
    )
  ) {

    return fallback;
  }


  return number;
}


export async function updateOrganizationSettingsAction(
  formData:
    FormData,
) {

  const {
    supabase,
    organization,
  } =
    await requireCurrentPermission(
      "settings.manage",
    );


  const {
    error,
  } =
    await supabase.rpc(
      "update_organization_settings",
      {

        target_org_id:
          organization.id,

        target_name:
          text(
            formData,
            "name",
          ),

        target_cnpj:
          optionalText(
            formData,
            "cnpj",
          ),

        target_legal_name:
          optionalText(
            formData,
            "legal_name",
          ),

        target_phone:
          optionalText(
            formData,
            "phone",
          ),

        target_whatsapp:
          optionalText(
            formData,
            "whatsapp",
          ),

        target_email:
          optionalText(
            formData,
            "email",
          ),

        target_postal_code:
          optionalText(
            formData,
            "postal_code",
          ),

        target_address_line:
          optionalText(
            formData,
            "address_line",
          ),

        target_address_number:
          optionalText(
            formData,
            "address_number",
          ),

        target_address_complement:
          optionalText(
            formData,
            "address_complement",
          ),

        target_district:
          optionalText(
            formData,
            "district",
          ),

        target_city:
          optionalText(
            formData,
            "city",
          ),

        target_state:
          optionalText(
            formData,
            "state",
          ),

        target_quote_validity_days:
          Math.trunc(
            numericValue(
              formData,
              "quote_validity_days",
              7,
            ),
          ),

        target_default_parts_margin_percent:
          numericValue(
            formData,
            "default_parts_margin_percent",
            30,
          ),

        target_default_quote_notes:
          optionalText(
            formData,
            "default_quote_notes",
          ),
      },
    );


  if (error) {

    redirect(
      `/dashboard/configuracoes?error=${encodeURIComponent(
        error.message,
      )}`,
    );
  }


  revalidatePath(
    "/dashboard",
    "layout",
  );


  revalidatePath(
    "/dashboard/configuracoes",
  );


  redirect(
    "/dashboard/configuracoes?saved=1",
  );
}