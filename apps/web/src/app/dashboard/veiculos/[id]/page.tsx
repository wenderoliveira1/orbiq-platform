import Link from "next/link";
import { notFound } from "next/navigation";

import { OperationalHistoryList } from "../../_components/operational-history-list";
import { getCurrentContext } from "../../_lib/current-organization";
import {
  buildVisitHistory,
  formatVisitDate,
  formatVisitKm,
  lastMileageFromVisits,
  novoOrcamentoHref,
} from "../../_lib/operational-history";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VehicleHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, organization } = await getCurrentContext();

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, customer_id, plate, brand, model, version, model_year, mileage, notes")
    .eq("organization_id", organization.id)
    .eq("id", id)
    .maybeSingle();

  if (vehicleError) throw new Error("Falha ao carregar veículo.");
  if (!vehicle) notFound();

  const [ownerResult, quotesResult] = await Promise.all([
    vehicle.customer_id
      ? supabase
          .from("customers")
          .select("id, name, phone")
          .eq("organization_id", organization.id)
          .eq("id", vehicle.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("quotes")
      .select("id, protocol, status, mileage, created_at, customer_id, vehicle_id")
      .eq("organization_id", organization.id)
      .eq("vehicle_id", vehicle.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (ownerResult.error) throw new Error("Falha ao carregar proprietário.");
  if (quotesResult.error) throw new Error("Falha ao carregar histórico do veículo.");

  const owner = ownerResult.data;
  const quotes = quotesResult.data ?? [];
  const quoteIds = quotes.map((quote) => quote.id);

  const servicesResult = quoteIds.length
    ? await supabase
        .from("quote_services")
        .select("quote_id, description")
        .eq("organization_id", organization.id)
        .in("quote_id", quoteIds)
    : { data: [], error: null };

  if (servicesResult.error) throw new Error("Falha ao carregar serviços do histórico.");

  const visits = buildVisitHistory({
    quotes,
    services: servicesResult.data ?? [],
    vehicleId: vehicle.id,
    limit: 20,
  });
  const lastVisit = visits[0] ?? null;
  const lastKm = lastMileageFromVisits(visits) ?? vehicle.mileage;
  const title = [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ") || "Veículo";

  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <div className="quote-detail-back">
            <Link href="/dashboard/veiculos">← Veículos</Link>
          </div>
          <span className="orbiq-eyebrow">HISTÓRICO DO VEÍCULO</span>
          <h1>
            <span className="orbiq-plate">{vehicle.plate}</span> {title}
          </h1>
          <p>Quando este carro volta, a oficina já sabe o que foi feito, o km e o último atendimento.</p>
        </div>
        {vehicle.customer_id ? (
          <Link
            href={novoOrcamentoHref(vehicle.customer_id, vehicle.id)}
            className="orbiq-primary-button"
            data-testid="vehicle-history-new-quote"
          >
            Novo orçamento
          </Link>
        ) : null}
      </section>

      <section className="quote-detail-grid">
        <article className="orbiq-panel">
          <span className="orbiq-eyebrow">IDENTIDADE</span>
          <div className="quote-detail-vehicle-title">
            <span className="orbiq-plate">{vehicle.plate}</span>
            <h2>{title}</h2>
          </div>
          <div className="quote-detail-info">
            <span>Ano</span>
            <strong>{vehicle.model_year ?? "—"}</strong>
            <span>Km cadastro</span>
            <strong>{formatVisitKm(vehicle.mileage)}</strong>
            <span>Km da última visita</span>
            <strong>{formatVisitKm(lastKm)}</strong>
            <span>Atendimentos</span>
            <strong>{visits.length}</strong>
          </div>
        </article>
        <article className="orbiq-panel">
          <span className="orbiq-eyebrow">PROPRIETÁRIO</span>
          {owner ? (
            <>
              <h2>{owner.name}</h2>
              <div className="quote-detail-info">
                <span>Telefone</span>
                <strong>{owner.phone || "—"}</strong>
                <span>Última visita</span>
                <strong>{lastVisit ? formatVisitDate(lastVisit.createdAt) : "—"}</strong>
              </div>
              <div className="ops-history-actions" style={{ marginTop: 14 }}>
                <Link href={`/dashboard/clientes/${owner.id}`} className="orbiq-secondary-button">
                  Histórico do cliente
                </Link>
              </div>
            </>
          ) : (
            <div className="orbiq-empty compact">
              <strong>Sem cliente vinculado.</strong>
              <span>Associe o veículo a um cliente no cadastro.</span>
            </div>
          )}
        </article>
      </section>

      {vehicle.notes ? (
        <section className="orbiq-panel">
          <span className="orbiq-eyebrow">OBSERVAÇÕES</span>
          <p className="orbiq-record-note" style={{ margin: "10px 0 0" }}>{vehicle.notes}</p>
        </section>
      ) : null}

      <section className="orbiq-panel" data-testid="vehicle-history-panel">
        <div className="orbiq-panel-heading">
          <div>
            <span className="orbiq-eyebrow">ATENDIMENTOS</span>
            <h2>Histórico deste veículo</h2>
          </div>
          <span className="orbiq-count-badge">{visits.length}</span>
        </div>
        <OperationalHistoryList
          visits={visits}
          emptyTitle="Nenhum orçamento neste veículo."
          emptyHint="O próximo atendimento passa a compor o histórico da placa."
          testId="vehicle-history-visits"
        />
      </section>
    </div>
  );
}
