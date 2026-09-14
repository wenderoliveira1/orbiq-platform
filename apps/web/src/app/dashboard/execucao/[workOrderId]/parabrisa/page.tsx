import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "../../../orcamentos/[id]/print-button";
import { compactQuoteProtocol } from "../../../_lib/compact-quote-protocol";
import { getCurrentContext } from "../../../_lib/current-organization";

type PageProps = {
  params: Promise<{ workOrderId: string }>;
};

function vehicleLine(vehicle: {
  plate: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  model_year: number | null;
}): string {
  return [vehicle.brand, vehicle.model, vehicle.version, vehicle.model_year]
    .filter(Boolean)
    .join(" ");
}

export default async function WorkOrderWindshieldPage({ params }: PageProps) {
  const { workOrderId } = await params;
  const { supabase, organization } = await getCurrentContext();

  const { data: workOrder, error: orderError } = await supabase
    .from("work_orders")
    .select("id, quote_id, code, status, notes, created_at")
    .eq("organization_id", organization.id)
    .eq("id", workOrderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Falha ao carregar OS: ${orderError.message}`);
  }

  if (!workOrder) {
    notFound();
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, protocol, customer_id, vehicle_id, mileage")
    .eq("organization_id", organization.id)
    .eq("id", workOrder.quote_id)
    .maybeSingle();

  if (quoteError || !quote) {
    throw new Error(quoteError?.message ?? "Orçamento da OS não encontrado.");
  }

  const [customerResult, vehicleResult, servicesResult, itemsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("organization_id", organization.id)
      .eq("id", quote.customer_id)
      .maybeSingle(),
    supabase
      .from("vehicles")
      .select("id, plate, brand, model, version, model_year")
      .eq("organization_id", organization.id)
      .eq("id", quote.vehicle_id)
      .maybeSingle(),
    supabase
      .from("work_order_services")
      .select("id, category, description, needs_part, status")
      .eq("organization_id", organization.id)
      .eq("work_order_id", workOrder.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("quote_items")
      .select("id, description, quantity, unit, side")
      .eq("organization_id", organization.id)
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: true }),
  ]);

  if (customerResult.error) throw new Error(customerResult.error.message);
  if (vehicleResult.error) throw new Error(vehicleResult.error.message);
  if (servicesResult.error) throw new Error(servicesResult.error.message);
  if (itemsResult.error) throw new Error(itemsResult.error.message);

  const customer = customerResult.data;
  const vehicle = vehicleResult.data;
  const services = servicesResult.data ?? [];
  const parts = itemsResult.data ?? [];
  const protocol = compactQuoteProtocol(quote.protocol);
  const plate = vehicle?.plate ?? "SEM PLACA";
  const issued = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(workOrder.created_at));

  return (
    <div className="orbiq-page os-windshield" data-testid="os-windshield">
      <div className="os-windshield-toolbar no-print">
        <Link href={`/dashboard/execucao/${workOrder.id}`} className="quote-back-link">
          ← Voltar para a OS
        </Link>
        <PrintButton documentTitle={`OS ${plate} — ${workOrder.code}`} label="Imprimir OS" />
      </div>

      <article className="os-windshield-sheet">
        <header className="os-windshield-head">
          <div>
            <span className="orbiq-eyebrow">ORDEM DE SERVIÇO · PARABRISA</span>
            <strong className="os-windshield-plate" data-testid="os-windshield-plate">
              {plate}
            </strong>
            <p>{vehicle ? vehicleLine(vehicle) : "Veículo"}</p>
          </div>
          <div className="os-windshield-meta">
            <span>{organization.name}</span>
            <strong data-testid="os-windshield-code">{workOrder.code}</strong>
            <small>
              {protocol} · {issued}
            </small>
          </div>
        </header>

        <dl className="os-windshield-id">
          <div>
            <dt>Cliente</dt>
            <dd>{customer?.name ?? "—"}</dd>
          </div>
          {quote.mileage != null ? (
            <div>
              <dt>Km</dt>
              <dd>{new Intl.NumberFormat("pt-BR").format(quote.mileage)}</dd>
            </div>
          ) : null}
        </dl>

        <section>
          <h2>Serviços a executar</h2>
          {services.length === 0 ? (
            <p className="os-windshield-empty">Nenhum serviço nesta OS.</p>
          ) : (
            <ol className="os-windshield-tasks" data-testid="os-windshield-services">
              {services.map((service) => (
                <li key={service.id}>
                  <span className="os-windshield-box" aria-hidden="true" />
                  <div>
                    <strong>{service.description}</strong>
                    <small>
                      {service.category}
                      {service.needs_part ? " · COM PEÇA" : ""}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {parts.length > 0 ? (
          <section data-testid="os-windshield-parts">
            <h2>Peças / materiais</h2>
            <ul className="os-windshield-parts">
              {parts.map((part) => (
                <li key={part.id}>
                  <span className="os-windshield-box" aria-hidden="true" />
                  <span>
                    {part.quantity} {part.unit} · {part.description}
                    {part.side ? ` · ${part.side}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {workOrder.notes ? (
          <section>
            <h2>Observação</h2>
            <p className="os-windshield-notes">{workOrder.notes}</p>
          </section>
        ) : null}

        <footer className="os-windshield-foot">
          <span>Colar no parabrisa. Sem valores.</span>
          <span>Mecânico: _______________________</span>
        </footer>
      </article>
    </div>
  );
}
