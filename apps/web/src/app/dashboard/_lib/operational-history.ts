import { statusLabel } from "../orcamentos/quote-meta";

export type HistoryQuoteRow = {
  id: string;
  protocol: string;
  status: string;
  mileage: number | null;
  created_at: string;
  customer_id: string;
  vehicle_id: string;
};

export type HistoryServiceRow = {
  quote_id: string;
  description: string;
};

export type HistoryVisit = {
  id: string;
  protocol: string;
  status: string;
  statusLabel: string;
  mileage: number | null;
  createdAt: string;
  customerId: string;
  vehicleId: string;
  services: string[];
};

export function buildVisitHistory({
  quotes,
  services,
  excludeQuoteId,
  vehicleId,
  customerId,
  limit = 12,
}: {
  quotes: HistoryQuoteRow[];
  services: HistoryServiceRow[];
  excludeQuoteId?: string;
  vehicleId?: string;
  customerId?: string;
  limit?: number;
}): HistoryVisit[] {
  const servicesByQuote = new Map<string, string[]>();

  for (const service of services) {
    const description = String(service.description ?? "").trim();
    if (!description) continue;
    const current = servicesByQuote.get(service.quote_id) ?? [];
    if (current.length < 6) current.push(description);
    servicesByQuote.set(service.quote_id, current);
  }

  return quotes
    .filter((quote) => {
      if (excludeQuoteId && quote.id === excludeQuoteId) return false;
      if (vehicleId && quote.vehicle_id !== vehicleId) return false;
      if (customerId && quote.customer_id !== customerId) return false;
      return true;
    })
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit)
    .map((quote) => ({
      id: quote.id,
      protocol: quote.protocol,
      status: quote.status,
      statusLabel: statusLabel(quote.status),
      mileage: quote.mileage,
      createdAt: quote.created_at,
      customerId: quote.customer_id,
      vehicleId: quote.vehicle_id,
      services: servicesByQuote.get(quote.id) ?? [],
    }));
}

export function lastMileageFromVisits(visits: HistoryVisit[]): number | null {
  for (const visit of visits) {
    if (visit.mileage !== null && visit.mileage !== undefined) {
      return visit.mileage;
    }
  }
  return null;
}

export function lastMileageByVehicleId(visits: HistoryVisit[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const visit of visits) {
    if (result[visit.vehicleId] !== undefined) continue;
    if (visit.mileage === null || visit.mileage === undefined) continue;
    result[visit.vehicleId] = visit.mileage;
  }
  return result;
}

export function formatVisitDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatVisitKm(value: number | null): string {
  if (value === null || value === undefined) return "Km não informado";
  return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

export function compactVisitServices(services: string[], max = 3): string {
  if (services.length === 0) return "Sem serviços registrados";
  const shown = services.slice(0, max);
  const extra = services.length - shown.length;
  return extra > 0 ? `${shown.join(" · ")} +${extra}` : shown.join(" · ");
}

export function novoOrcamentoHref(customerId?: string | null, vehicleId?: string | null): string {
  const params = new URLSearchParams();
  if (customerId) params.set("customer", customerId);
  if (vehicleId) params.set("vehicle", vehicleId);
  const query = params.toString();
  return query ? `/dashboard/orcamentos/novo?${query}` : "/dashboard/orcamentos/novo";
}
