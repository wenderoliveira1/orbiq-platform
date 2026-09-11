import Link from "next/link";
import { notFound } from "next/navigation";

import { OperationalHistoryList } from "../../_components/operational-history-list";
import { getCurrentContext } from "../../_lib/current-organization";
import {
  buildVisitHistory,
  formatVisitDate,
  formatVisitKm,
  novoOrcamentoHref,
} from "../../_lib/operational-history";

type PageProps = {
  params: Promise<{ id: string }>;
};

function vehicleTitle(vehicle: {
  brand: string | null;
  model: string | null;
  version: string | null;
}) {
  return [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ") || "Veículo";
}

export default async function CustomerHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, organization } = await getCurrentContext();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, phone, email, notes")
    .eq("organization_id", organization.id)
    .eq("id", id)
    .maybeSingle();

  if (customerError) {
    throw new Error("Falha ao carregar cliente.");
  }
  if (!customer) notFound();

  const [vehiclesResult, quotesResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, plate, brand, model, version, model_year, mileage")
      .eq("organization_id", organization.id)
      .eq("customer_id", customer.id)
      .order("plate", { ascending: true }),
    supabase
      .from("quotes")
      .select("id, protocol, status, mileage, created_at, customer_id, vehicle_id")
      .eq("organization_id", organization.id)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (vehiclesResult.error) throw new Error("Falha ao carregar veículos do cliente.");
  if (quotesResult.error) throw new Error("Falha ao carregar histórico do cliente.");

  const vehicles = vehiclesResult.data ?? [];
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
    customerId: customer.id,
    limit: 20,
  });
  const lastVisit = visits[0] ?? null;
  const plateByVehicle = Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle.plate]));

  return (
    <div className="orbiq-page">
      <section className="orbiq-page-heading">
        <div>
          <div className="quote-detail-back">
            <Link href="/dashboard/clientes">← Clientes</Link>
          </div>
          <span className="orbiq-eyebrow">HISTÓRICO DO CLIENTE</span>
          <h1>{customer.name}</h1>
          <p>Veículos, última visita e o que já foi feito — para não repetir serviço nem perder recorrência.</p>
        </div>
        <Link
          href={novoOrcamentoHref(customer.id)}
          className="orbiq-primary-button"
          data-testid="customer-history-new-quote"
        >
          Novo orçamento
        </Link>
      </section>

      <section className="quote-detail-grid">
        <article className="orbiq-panel">
          <span className="orbiq-eyebrow">CONTATO</span>
          <h2>{customer.name}</h2>
          <div className="quote-detail-info">
            <span>Telefone</span>
            <strong>{customer.phone || "—"}</strong>
            <span>E-mail</span>
            <strong>{customer.email || "—"}</strong>
            <span>Atendimentos</span>
            <strong>{visits.length}</strong>
          </div>
        </article>
        <article className="orbiq-panel">
          <span className="orbiq-eyebrow">ÚLTIMA VISITA</span>
          {lastVisit ? (
            <>
              <h2>{formatVisitDate(lastVisit.createdAt)}</h2>
              <div className="quote-detail-info">
                <span>Protocolo</span>
                <strong>{lastVisit.protocol}</strong>
                <span>Status</span>
                <strong>{lastVisit.statusLabel}</strong>
                <span>Km</span>
                <strong>{formatVisitKm(lastVisit.mileage)}</strong>
              </div>
            </>
          ) : (
            <div className="orbiq-empty compact">
              <strong>Ainda sem orçamento.</strong>
              <span>O primeiro atendimento deste cliente começa agora.</span>
            </div>
          )}
        </article>
      </section>

      {customer.notes ? (
        <section className="orbiq-panel">
          <span className="orbiq-eyebrow">OBSERVAÇÕES</span>
          <p className="orbiq-record-note" style={{ margin: "10px 0 0" }}>{customer.notes}</p>
        </section>
      ) : null}

      <section className="orbiq-panel">
        <div className="orbiq-panel-heading">
          <div>
            <span className="orbiq-eyebrow">VEÍCULOS</span>
            <h2>Carros deste cliente</h2>
          </div>
          <span className="orbiq-count-badge">{vehicles.length}</span>
        </div>
        {vehicles.length === 0 ? (
          <div className="orbiq-empty compact">
            <strong>Nenhum veículo cadastrado.</strong>
            <span>Cadastre o veículo em Veículos para reutilizar placa e histórico.</span>
          </div>
        ) : (
          <div className="ops-history-list">
            {vehicles.map((vehicle) => {
              const vehicleVisits = visits.filter((visit) => visit.vehicleId === vehicle.id);
              return (
                <article key={vehicle.id} className="ops-history-row">
                  <span className="orbiq-plate">{vehicle.plate}</span>
                  <div className="ops-history-main">
                    <strong>{vehicleTitle(vehicle)}</strong>
                    <p>
                      {formatVisitKm(vehicle.mileage)}
                      {vehicle.model_year ? ` · Ano ${vehicle.model_year}` : ""}
                      {vehicleVisits[0]
                        ? ` · última visita ${formatVisitDate(vehicleVisits[0].createdAt)}`
                        : " · sem orçamento"}
                    </p>
                  </div>
                  <div className="ops-history-actions">
                    <Link href={`/dashboard/veiculos/${vehicle.id}`} className="orbiq-secondary-button">
                      Histórico
                    </Link>
                    <Link
                      href={novoOrcamentoHref(customer.id, vehicle.id)}
                      className="orbiq-primary-button"
                    >
                      Novo
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="orbiq-panel" data-testid="customer-history-panel">
        <div className="orbiq-panel-heading">
          <div>
            <span className="orbiq-eyebrow">ATENDIMENTOS</span>
            <h2>Histórico de orçamentos</h2>
          </div>
          <span className="orbiq-count-badge">{visits.length}</span>
        </div>
        <OperationalHistoryList
          visits={visits}
          emptyTitle="Nenhum orçamento ainda."
          emptyHint="Quando este cliente for atendido, os serviços aparecem aqui."
          testId="customer-history-visits"
          showVehiclePlate={plateByVehicle}
        />
      </section>
    </div>
  );
}
