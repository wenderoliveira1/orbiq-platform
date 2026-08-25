export const WORKSHOP_BRANDING_BUCKET =
  "organization-branding";

export const DEFAULT_WORKSHOP_BRAND_COLOR =
  "#111827";

export type WorkshopBrandingManifest = {
  version: 1;
  logoPath: string | null;
  primaryColor: string;
  tagline: string | null;
};

const defaultManifest: WorkshopBrandingManifest = {
  version: 1,
  logoPath: null,
  primaryColor: DEFAULT_WORKSHOP_BRAND_COLOR,
  tagline: null,
};

export function normalizeWorkshopBrandColor(
  value: unknown,
): string {
  if (
    typeof value === "string" &&
    /^#[0-9a-f]{6}$/i.test(value.trim())
  ) {
    return value.trim().toUpperCase();
  }

  return DEFAULT_WORKSHOP_BRAND_COLOR;
}

function cleanTagline(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();

  if (!clean || clean.length > 120) {
    return null;
  }

  return clean;
}

function storageBaseUrl(): string | null {
  const apiUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!apiUrl) {
    return null;
  }

  return apiUrl.replace(/\/+$/, "");
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function workshopStoragePublicUrl(
  path: string | null | undefined,
): string | null {
  const base = storageBaseUrl();
  const cleanPath = path?.trim();

  if (!base || !cleanPath) {
    return null;
  }

  return `${base}/storage/v1/object/public/${WORKSHOP_BRANDING_BUCKET}/${encodeStoragePath(
    cleanPath,
  )}`;
}

export function workshopLogoUrl(
  path: string | null | undefined,
): string | null {
  return workshopStoragePublicUrl(path);
}

export function workshopBrandingManifestPath(
  organizationId: string,
): string {
  return `${organizationId}/branding.json`;
}

export async function loadWorkshopBrandingByPath(
  manifestPath: string,
): Promise<WorkshopBrandingManifest> {
  const url = workshopStoragePublicUrl(manifestPath);

  if (!url) {
    return { ...defaultManifest };
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { ...defaultManifest };
    }

    const raw = (await response.json()) as {
      version?: unknown;
      logoPath?: unknown;
      primaryColor?: unknown;
      tagline?: unknown;
    };

    const organizationPrefix =
      `${manifestPath.split("/")[0]}/`;

    const logoPath =
      typeof raw.logoPath === "string" &&
      raw.logoPath.startsWith(organizationPrefix) &&
      !raw.logoPath.includes("..")
        ? raw.logoPath
        : null;

    return {
      version: 1,
      logoPath,
      primaryColor: normalizeWorkshopBrandColor(
        raw.primaryColor,
      ),
      tagline: cleanTagline(raw.tagline),
    };
  } catch {
    return { ...defaultManifest };
  }
}

export async function loadWorkshopBranding(
  organizationId: string,
): Promise<WorkshopBrandingManifest> {
  return loadWorkshopBrandingByPath(
    workshopBrandingManifestPath(organizationId),
  );
}
