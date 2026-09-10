export const QUOTE_BUILDER_DRAFT_VERSION = 1 as const;
export const QUOTE_BUILDER_DRAFT_DEBOUNCE_MS = 450;
export const QUOTE_BUILDER_SERVER_SYNC_DEBOUNCE_MS = 2_000;

export type QuoteBuilderDraftPriority = "normal" | "customer_waiting" | "vehicle_stopped";
export type QuoteBuilderDraftStep = 1 | 2 | 3 | 4;

export type QuoteBuilderDraftSelectedService = {
  key: string;
  serviceCatalogId: string | null;
  category: string;
  description: string;
  laborAmount: number;
  quantity: string;
  needsPart: boolean;
  partDescription: string;
  partCategory: string;
  partQuantity: string;
  partUnit: string;
  partSide: string;
  partSpecification: string;
  hasManualPrice: boolean;
  partCost: string;
  partSale: string;
};

export type QuoteBuilderDraftExtraItem = {
  key: string;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  side: string;
  specification: string;
  hasManualPrice: boolean;
  partCost: string;
  partSale: string;
};

export type QuoteBuilderDraft = {
  version: typeof QUOTE_BUILDER_DRAFT_VERSION;
  updatedAt: string;
  organizationId: string;
  userId: string;
  openStep: QuoteBuilderDraftStep;
  customerId: string;
  vehicleId: string;
  mileage: string;
  priority: QuoteBuilderDraftPriority;
  notes: string;
  serviceCategory: string;
  selectedServices: QuoteBuilderDraftSelectedService[];
  extraItems: QuoteBuilderDraftExtraItem[];
  serverDraftQuoteId: string | null;
  serverDraftProtocol: string | null;
};

const PRIORITIES = new Set<QuoteBuilderDraftPriority>([
  "normal",
  "customer_waiting",
  "vehicle_stopped",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, max = 4_000): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function asNullableString(value: unknown, max = 120): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function parseStep(value: unknown): QuoteBuilderDraftStep {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

function parsePriority(value: unknown): QuoteBuilderDraftPriority {
  return typeof value === "string" && PRIORITIES.has(value as QuoteBuilderDraftPriority)
    ? (value as QuoteBuilderDraftPriority)
    : "normal";
}

function parseSelectedService(value: unknown): QuoteBuilderDraftSelectedService | null {
  if (!isPlainObject(value)) return null;
  const key = asString(value.key, 120).trim();
  if (!key) return null;
  return {
    key,
    serviceCatalogId: asNullableString(value.serviceCatalogId, 64),
    category: asString(value.category, 80),
    description: asString(value.description, 300),
    laborAmount: asNumber(value.laborAmount, 0),
    quantity: asString(value.quantity, 32) || "1",
    needsPart: asBoolean(value.needsPart),
    partDescription: asString(value.partDescription, 300),
    partCategory: asString(value.partCategory, 80) || "MECÂNICA",
    partQuantity: asString(value.partQuantity, 32) || "1",
    partUnit: asString(value.partUnit, 40) || "UN",
    partSide: asString(value.partSide, 80),
    partSpecification: asString(value.partSpecification, 300),
    hasManualPrice: asBoolean(value.hasManualPrice),
    partCost: asString(value.partCost, 40),
    partSale: asString(value.partSale, 40),
  };
}

function parseExtraItem(value: unknown): QuoteBuilderDraftExtraItem | null {
  if (!isPlainObject(value)) return null;
  const key = asString(value.key, 120).trim();
  const description = asString(value.description, 300).trim();
  if (!key || !description) return null;
  return {
    key,
    category: asString(value.category, 80) || "MECÂNICA",
    description,
    quantity: asString(value.quantity, 32) || "1",
    unit: asString(value.unit, 40) || "UN",
    side: asString(value.side, 80),
    specification: asString(value.specification, 300),
    hasManualPrice: asBoolean(value.hasManualPrice),
    partCost: asString(value.partCost, 40),
    partSale: asString(value.partSale, 40),
  };
}

export function quoteBuilderDraftStorageKey(organizationId: string, userId: string): string {
  return `orbiq:quote-builder-draft:v1:${organizationId}:${userId}`;
}

export function isMeaningfulQuoteBuilderDraft(
  draft: Pick<
    QuoteBuilderDraft,
    | "customerId"
    | "vehicleId"
    | "mileage"
    | "notes"
    | "selectedServices"
    | "extraItems"
    | "serverDraftQuoteId"
  >,
): boolean {
  return Boolean(
    draft.customerId.trim() ||
      draft.vehicleId.trim() ||
      draft.mileage.trim() ||
      draft.notes.trim() ||
      draft.selectedServices.length > 0 ||
      draft.extraItems.length > 0 ||
      draft.serverDraftQuoteId,
  );
}

export function canSyncQuoteBuilderDraftToServer(
  draft: Pick<QuoteBuilderDraft, "customerId" | "vehicleId" | "mileage" | "selectedServices">,
): boolean {
  return Boolean(
    draft.customerId.trim() &&
      draft.vehicleId.trim() &&
      draft.mileage.trim() &&
      draft.selectedServices.length > 0,
  );
}

export function parseQuoteBuilderDraft(raw: string | null | undefined): QuoteBuilderDraft | null {
  if (!raw || typeof raw !== "string") return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(value) || value.version !== QUOTE_BUILDER_DRAFT_VERSION) return null;

  const organizationId = asString(value.organizationId, 64).trim();
  const userId = asString(value.userId, 64).trim();
  if (!organizationId || !userId) return null;

  const selectedServicesRaw = Array.isArray(value.selectedServices) ? value.selectedServices : [];
  const extraItemsRaw = Array.isArray(value.extraItems) ? value.extraItems : [];
  if (selectedServicesRaw.length > 100 || extraItemsRaw.length > 250) return null;

  const selectedServices: QuoteBuilderDraftSelectedService[] = [];
  for (const entry of selectedServicesRaw) {
    const parsed = parseSelectedService(entry);
    if (!parsed) return null;
    selectedServices.push(parsed);
  }

  const extraItems: QuoteBuilderDraftExtraItem[] = [];
  for (const entry of extraItemsRaw) {
    const parsed = parseExtraItem(entry);
    if (!parsed) return null;
    extraItems.push(parsed);
  }

  return {
    version: QUOTE_BUILDER_DRAFT_VERSION,
    updatedAt: asString(value.updatedAt, 64) || new Date(0).toISOString(),
    organizationId,
    userId,
    openStep: parseStep(value.openStep),
    customerId: asString(value.customerId, 64),
    vehicleId: asString(value.vehicleId, 64),
    mileage: asString(value.mileage, 32).replace(/\D/g, ""),
    priority: parsePriority(value.priority),
    notes: asString(value.notes, 4_000),
    serviceCategory: asString(value.serviceCategory, 80),
    selectedServices,
    extraItems,
    serverDraftQuoteId: asNullableString(value.serverDraftQuoteId, 64),
    serverDraftProtocol: asNullableString(value.serverDraftProtocol, 80),
  };
}

export function serializeQuoteBuilderDraft(draft: QuoteBuilderDraft): string {
  return JSON.stringify(draft);
}

export function readQuoteBuilderDraft(
  organizationId: string,
  userId: string,
): QuoteBuilderDraft | null {
  if (typeof window === "undefined" || !organizationId || !userId) return null;
  try {
    const raw = window.localStorage.getItem(quoteBuilderDraftStorageKey(organizationId, userId));
    const parsed = parseQuoteBuilderDraft(raw);
    if (!parsed) return null;
    if (parsed.organizationId !== organizationId || parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeQuoteBuilderDraft(draft: QuoteBuilderDraft): void {
  if (typeof window === "undefined") return;
  if (!isMeaningfulQuoteBuilderDraft(draft)) {
    clearQuoteBuilderDraft(draft.organizationId, draft.userId);
    return;
  }
  try {
    window.localStorage.setItem(
      quoteBuilderDraftStorageKey(draft.organizationId, draft.userId),
      serializeQuoteBuilderDraft({
        ...draft,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Quota / private mode: ignore — final submit still works.
  }
}

export function clearQuoteBuilderDraft(organizationId: string, userId: string): void {
  if (typeof window === "undefined" || !organizationId || !userId) return;
  try {
    window.localStorage.removeItem(quoteBuilderDraftStorageKey(organizationId, userId));
  } catch {
    // ignore
  }
}
