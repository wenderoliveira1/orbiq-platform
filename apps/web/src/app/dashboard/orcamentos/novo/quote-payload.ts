export const quotePriorities = [
  "normal",
  "customer_waiting",
  "vehicle_stopped",
] as const;

export type QuotePriority = (typeof quotePriorities)[number];

export type QuoteServicePayload = {
  labor_service_id: string | null;
  category: string;
  description: string;
  labor_amount: number;
  needs_part: boolean;
};

export type QuoteItemPayload = {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  side: string | null;
  specification: string | null;
  notes: string | null;
};

export type QuotePayload = {
  priority: QuotePriority;
  services: QuoteServicePayload[];
  items: QuoteItemPayload[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength: number, allowEmpty = false): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return false;
  return trimmed.length <= maxLength;
}

function nullableBoundedText(value: unknown, maxLength: number): value is string | null {
  return value === null || boundedText(value, maxLength, true);
}

function validMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000;
}

function validQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 100_000;
}

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export function parseQuotePriority(value: string): QuotePriority | null {
  return (quotePriorities as readonly string[]).includes(value)
    ? (value as QuotePriority)
    : null;
}

export function parseQuotePayload(servicesRaw: string, itemsRaw: string, priorityRaw: string): QuotePayload | null {
  const priority = parseQuotePriority(priorityRaw);
  if (!priority) return null;

  let servicesValue: unknown;
  let itemsValue: unknown;

  try {
    servicesValue = JSON.parse(servicesRaw || "[]");
    itemsValue = JSON.parse(itemsRaw || "[]");
  } catch {
    return null;
  }

  if (!Array.isArray(servicesValue) || servicesValue.length === 0 || servicesValue.length > 100) {
    return null;
  }

  if (!Array.isArray(itemsValue) || itemsValue.length > 250) {
    return null;
  }

  const services: QuoteServicePayload[] = [];
  for (const value of servicesValue) {
    if (!isPlainObject(value)) return null;
    const laborServiceId = value.labor_service_id;
    if (!(laborServiceId === null || (typeof laborServiceId === "string" && isUuid(laborServiceId)))) return null;
    if (!boundedText(value.category, 80)) return null;
    if (!boundedText(value.description, 300)) return null;
    if (!validMoney(value.labor_amount)) return null;
    if (typeof value.needs_part !== "boolean") return null;

    services.push({
      labor_service_id: laborServiceId,
      category: value.category.trim(),
      description: value.description.trim(),
      labor_amount: value.labor_amount,
      needs_part: value.needs_part,
    });
  }

  const items: QuoteItemPayload[] = [];
  for (const value of itemsValue) {
    if (!isPlainObject(value)) return null;
    if (!boundedText(value.category, 80)) return null;
    if (!boundedText(value.description, 300)) return null;
    if (!validQuantity(value.quantity)) return null;
    if (!boundedText(value.unit, 40)) return null;
    if (!nullableBoundedText(value.side, 80)) return null;
    if (!nullableBoundedText(value.specification, 300)) return null;
    if (!nullableBoundedText(value.notes, 500)) return null;

    items.push({
      category: value.category.trim(),
      description: value.description.trim(),
      quantity: value.quantity,
      unit: value.unit.trim(),
      side: value.side === null ? null : value.side.trim() || null,
      specification: value.specification === null ? null : value.specification.trim() || null,
      notes: value.notes === null ? null : value.notes.trim() || null,
    });
  }

  return { priority, services, items };
}
