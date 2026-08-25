"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  loadWorkshopBranding,
  normalizeWorkshopBrandColor,
  workshopBrandingManifestPath,
  WORKSHOP_BRANDING_BUCKET,
  type WorkshopBrandingManifest,
} from "../../../lib/workshop-branding";

import {
  requireCurrentPermission,
} from "../_lib/permissions";

const MAX_LOGO_BYTES =
  2 * 1024 * 1024;

function text(
  formData: FormData,
  field: string,
): string {
  return String(
    formData.get(field) ?? "",
  ).trim();
}

function optionalText(
  formData: FormData,
  field: string,
): string | null {
  const value = text(formData, field);
  return value || null;
}

function numericValue(
  formData: FormData,
  field: string,
  fallback: number,
): number {
  const value = text(formData, field).replace(",", ".");

  if (!value) {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function fail(message: string): never {
  redirect(
    `/dashboard/configuracoes?error=${encodeURIComponent(message)}`,
  );
}

type ValidLogo = {
  extension: "png" | "jpg" | "webp";
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

async function validateLogo(file: File): Promise<ValidLogo> {
  if (file.size <= 0) {
    fail("O arquivo da logo está vazio.");
  }

  if (file.size > MAX_LOGO_BYTES) {
    fail("A logo deve ter no máximo 2 MB.");
  }

  const bytes = new Uint8Array(
    await file.slice(0, 16).arrayBuffer(),
  );

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (isPng) {
    return {
      extension: "png",
      mimeType: "image/png",
    };
  }

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  if (isJpeg) {
    return {
      extension: "jpg",
      mimeType: "image/jpeg",
    };
  }

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));

  const isWebp =
    bytes.length >= 12 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 12) === "WEBP";

  if (isWebp) {
    return {
      extension: "webp",
      mimeType: "image/webp",
    };
  }

  fail(
    "Formato de logo inválido. Envie PNG, JPG/JPEG ou WebP.",
  );
}

async function removeStorageObject(
  supabase: Awaited<ReturnType<typeof requireCurrentPermission>>["supabase"],
  path: string | null,
) {
  if (!path) {
    return;
  }

  await supabase.storage
    .from(WORKSHOP_BRANDING_BUCKET)
    .remove([path]);
}

export async function updateOrganizationSettingsAction(
  formData: FormData,
) {
  const {
    supabase,
    organization,
  } = await requireCurrentPermission(
    "settings.manage",
  );

  const validityDays = Math.trunc(
    numericValue(
      formData,
      "quote_validity_days",
      7,
    ),
  );

  const partsMargin = numericValue(
    formData,
    "default_parts_margin_percent",
    30,
  );

  if (
    validityDays < 1 ||
    validityDays > 90
  ) {
    fail("A validade padrão deve ficar entre 1 e 90 dias.");
  }

  if (
    partsMargin < 0 ||
    partsMargin > 1000
  ) {
    fail("A margem padrão deve ficar entre 0% e 1000%.");
  }

  const rawBrandColor = text(
    formData,
    "brand_primary_color",
  );

  if (!/^#[0-9a-f]{6}$/i.test(rawBrandColor)) {
    fail("A cor principal da marca é inválida.");
  }

  const brandColor = normalizeWorkshopBrandColor(
    rawBrandColor,
  );

  const brandTagline = optionalText(
    formData,
    "brand_tagline",
  );

  if (
    brandTagline &&
    brandTagline.length > 120
  ) {
    fail("A assinatura da marca deve ter no máximo 120 caracteres.");
  }

  const removeLogo =
    text(formData, "remove_logo") === "1";

  const logoEntry = formData.get("logo");
  const logoFile =
    logoEntry instanceof File &&
    logoEntry.size > 0
      ? logoEntry
      : null;

  if (removeLogo && logoFile) {
    fail(
      "Escolha entre remover a logo atual ou enviar uma nova logo.",
    );
  }

  const currentBranding =
    await loadWorkshopBranding(
      organization.id,
    );

  let uploadedLogoPath: string | null = null;

  if (logoFile) {
    const validLogo = await validateLogo(logoFile);

    uploadedLogoPath = `${organization.id}/logo-${Date.now()}.${validLogo.extension}`;

    const {
      error: uploadError,
    } = await supabase.storage
      .from(WORKSHOP_BRANDING_BUCKET)
      .upload(
        uploadedLogoPath,
        logoFile,
        {
          contentType: validLogo.mimeType,
          cacheControl: "31536000",
          upsert: false,
        },
      );

    if (uploadError) {
      fail(
        `Falha ao enviar a logo: ${uploadError.message}`,
      );
    }
  }

  const {
    error,
  } = await supabase.rpc(
    "update_organization_settings",
    {
      target_org_id: organization.id,
      target_name: text(formData, "name"),
      target_cnpj: optionalText(formData, "cnpj"),
      target_legal_name: optionalText(formData, "legal_name"),
      target_phone: optionalText(formData, "phone"),
      target_whatsapp: optionalText(formData, "whatsapp"),
      target_email: optionalText(formData, "email"),
      target_postal_code: optionalText(formData, "postal_code"),
      target_address_line: optionalText(formData, "address_line"),
      target_address_number: optionalText(formData, "address_number"),
      target_address_complement: optionalText(
        formData,
        "address_complement",
      ),
      target_district: optionalText(formData, "district"),
      target_city: optionalText(formData, "city"),
      target_state: optionalText(formData, "state"),
      target_quote_validity_days: validityDays,
      target_default_parts_margin_percent: partsMargin,
      target_default_quote_notes: optionalText(
        formData,
        "default_quote_notes",
      ),
    },
  );

  if (error) {
    await removeStorageObject(
      supabase,
      uploadedLogoPath,
    );

    fail(error.message);
  }

  const finalLogoPath = removeLogo
    ? null
    : uploadedLogoPath ?? currentBranding.logoPath;

  const manifest: WorkshopBrandingManifest = {
    version: 1,
    logoPath: finalLogoPath,
    primaryColor: brandColor,
    tagline: brandTagline,
  };

  const manifestPath = workshopBrandingManifestPath(
    organization.id,
  );

  const manifestBlob = new Blob(
    [JSON.stringify(manifest, null, 2)],
    {
      type: "application/json",
    },
  );

  const {
    error: manifestError,
  } = await supabase.storage
    .from(WORKSHOP_BRANDING_BUCKET)
    .upload(
      manifestPath,
      manifestBlob,
      {
        contentType: "application/json",
        cacheControl: "60",
        upsert: true,
      },
    );

  if (manifestError) {
    await removeStorageObject(
      supabase,
      uploadedLogoPath,
    );

    fail(
      `Dados gerais salvos, mas a identidade visual não pôde ser salva: ${manifestError.message}`,
    );
  }

  const previousLogoPath = currentBranding.logoPath;

  if (
    previousLogoPath &&
    previousLogoPath !== finalLogoPath
  ) {
    await removeStorageObject(
      supabase,
      previousLogoPath,
    );
  }

  revalidatePath(
    "/dashboard",
    "layout",
  );

  revalidatePath(
    "/dashboard/configuracoes",
  );

  revalidatePath(
    "/dashboard/comercial",
    "layout",
  );

  redirect(
    "/dashboard/configuracoes?saved=1",
  );
}
