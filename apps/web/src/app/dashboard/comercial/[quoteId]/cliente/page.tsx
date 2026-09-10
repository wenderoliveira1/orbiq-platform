import { notFound } from "next/navigation";

import {
  loadWorkshopBranding,
  workshopLogoUrl,
} from "../../../../../lib/workshop-branding";

import { getCurrentContext } from "../../../_lib/current-organization";
import { CustomerQuoteToolbar } from "./customer-quote-toolbar";

type WorkshopProfile = {
  organization_name: string;
  organization_cnpj: string | null;
  legal_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postal_code: string | null;
  address_line: string | null;
  address_number: string | null;
  address_complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  quote_validity_days: number;
  default_quote_notes: string | null;
};

type PageProps = {
  params: Promise<{
    quoteId: string;
  }>;
};

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function number(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

function date(raw: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(raw));
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Em elaboração",
    ready: "Aguardando aprovação",
    approved: "Aprovado",
    rejected: "Reprovado",
  };

  return labels[status] ?? status;
}

export default async function CustomerQuotePage({ params }: PageProps) {
  const { quoteId } = await params;
  const { supabase, organization } = await getCurrentContext();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, protocol, customer_id, vehicle_id, mileage, commercial_status, subtotal_amount, discount_amount, final_amount, created_at",
    )
    .eq("organization_id", organization.id)
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteError) {
    throw new Error(quoteError.message);
  }

  if (!quote) {
    notFound();
  }

  const [customerResult, vehicleResult, servicesResult, itemsResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, name, phone, email")
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
        .from("quote_services")
        .select("id, category, description, labor_amount")
        .eq("organization_id", organization.id)
        .eq("quote_id", quote.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("quote_items")
        .select(
          "id, category, description, quantity, unit, side, specification, sale_unit_amount, sale_total_amount",
        )
        .eq("organization_id", organization.id)
        .eq("quote_id", quote.id)
        .order("created_at", { ascending: true }),
    ]);

  if (customerResult.error) {
    throw new Error(customerResult.error.message);
  }

  if (vehicleResult.error) {
    throw new Error(vehicleResult.error.message);
  }

  if (servicesResult.error) {
    throw new Error(servicesResult.error.message);
  }

  if (itemsResult.error) {
    throw new Error(itemsResult.error.message);
  }

  const { data: workshopProfileData, error: workshopProfileError } =
    await supabase.rpc("get_organization_document_profile", {
      target_org_id: organization.id,
    });

  if (workshopProfileError || !workshopProfileData) {
    throw new Error(
      `Falha ao carregar os dados da oficina: ${
        workshopProfileError?.message ?? "perfil não encontrado"
      }`,
    );
  }

  const workshop = workshopProfileData as unknown as WorkshopProfile;
  const branding = await loadWorkshopBranding(organization.id);
  const logoUrl = workshopLogoUrl(branding.logoPath);

  const customer = customerResult.data;
  const vehicle = vehicleResult.data;
  const services = servicesResult.data ?? [];
  const items = itemsResult.data ?? [];

  const workshopContacts = [
    workshop.phone ? `Telefone ${workshop.phone}` : null,
    workshop.whatsapp ? `WhatsApp ${workshop.whatsapp}` : null,
    workshop.email,
  ]
    .filter(Boolean)
    .join(" · ");

  const workshopAddress = [
    [workshop.address_line, workshop.address_number].filter(Boolean).join(", "),
    workshop.address_complement,
    workshop.district,
    [workshop.city, workshop.state].filter(Boolean).join(" / "),
    workshop.postal_code ? `CEP ${workshop.postal_code}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const laborTotal = services.reduce(
    (total, service) => total + (service.labor_amount ?? 0),
    0,
  );

  const partsTotal = items.reduce(
    (total, item) => total + (item.sale_total_amount ?? 0),
    0,
  );

  const subtotal = quote.subtotal_amount ?? laborTotal + partsTotal;
  const discount = quote.discount_amount ?? 0;
  const finalAmount = quote.final_amount ?? subtotal - discount;
  const readyForCustomer =
    quote.commercial_status !== "draft" && quote.final_amount !== null;

  if (!readyForCustomer) {
    return (
      <div className="customer-quote-page">
        <CustomerQuoteToolbar
          quoteId={quote.id}
          protocol={quote.protocol}
          workshopName={organization.name}
          customerName={customer?.name ?? "Cliente"}
          customerPhone={customer?.phone ?? null}
          vehiclePlate={vehicle?.plate ?? "Veículo"}
          totalFormatted={money(0)}
        />

        <section className="customer-quote-not-ready">
          <span>ORÇAMENTO COMERCIAL</span>
          <h1>Orçamento ainda não está pronto.</h1>
          <p>
            Defina os preços de venda e salve o orçamento comercial antes de
            gerar a versão do cliente.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="customer-quote-page">
      <CustomerQuoteToolbar
        quoteId={quote.id}
        protocol={quote.protocol}
        workshopName={organization.name}
        customerName={customer?.name ?? "Cliente"}
        customerPhone={customer?.phone ?? null}
        vehiclePlate={vehicle?.plate ?? "Veículo"}
        totalFormatted={money(finalAmount)}
      />

      <article className="customer-quote-document">
        <header className="customer-quote-header customer-quote-letterhead">
          <div className="customer-quote-brand">
            <span
              data-testid="workshop-logo"
              aria-label={`Marca ${workshop.organization_name}`}
              style={{
                backgroundColor: logoUrl ? "#ffffff" : branding.primaryColor,
                backgroundImage: logoUrl ? `url("${logoUrl}")` : undefined,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "contain",
                color: logoUrl ? "transparent" : "#ffffff",
              }}
            >
              {logoUrl ? null : "O"}
            </span>

            <div className="customer-quote-letterhead-copy">
              <strong>{workshop.organization_name}</strong>
              <small>
                {branding.tagline ??
                  workshop.legal_name ??
                  "Documento comercial para o cliente"}
              </small>
              {workshop.organization_cnpj ? (
                <small>CNPJ {workshop.organization_cnpj}</small>
              ) : null}
              {workshopContacts ? <small>{workshopContacts}</small> : null}
              {workshopAddress ? <small>{workshopAddress}</small> : null}
              <small>Orçamento {quote.protocol}</small>
              <small>
                Validade comercial: {workshop.quote_validity_days} dias
              </small>
              <small className="workshop-letterhead-powered">Powered by Orbiq</small>
            </div>
          </div>

          <div className="customer-quote-number">
            <span
              className={`customer-quote-status customer-status-${quote.commercial_status}`}
            >
              {statusLabel(quote.commercial_status)}
            </span>
            <strong>{quote.protocol}</strong>
            <small>Emitido em {date(quote.created_at)}</small>
          </div>
        </header>

        <section className="customer-quote-info-grid">
          <div>
            <span className="customer-section-label">CLIENTE</span>
            <strong>{customer?.name ?? "Cliente"}</strong>
            {customer?.phone ? <small>{customer.phone}</small> : null}
            {customer?.email ? <small>{customer.email}</small> : null}
          </div>

          <div>
            <span className="customer-section-label">VEÍCULO</span>
            <strong>{vehicle?.plate ?? "—"}</strong>
            <small>
              {[vehicle?.brand, vehicle?.model, vehicle?.version]
                .filter(Boolean)
                .join(" ") || "Veículo"}
            </small>
            <small>
              {vehicle?.model_year ? `Ano ${vehicle.model_year}` : ""}
              {quote.mileage !== null
                ? `${vehicle?.model_year ? " · " : ""}${number(quote.mileage)} km`
                : ""}
            </small>
          </div>
        </section>

        <section className="customer-quote-section">
          <div className="customer-quote-section-heading">
            <div>
              <span className="customer-section-label">SERVIÇOS</span>
              <h2>Mão de obra</h2>
            </div>
            <strong>{money(laborTotal)}</strong>
          </div>

          <div className="customer-service-table">
            {services.map((service, index) => (
              <div key={service.id} className="customer-service-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{service.description}</strong>
                  <small>{service.category}</small>
                </div>
                <strong>{money(service.labor_amount ?? 0)}</strong>
              </div>
            ))}
          </div>
        </section>

        {items.length > 0 ? (
          <section className="customer-quote-section">
            <div className="customer-quote-section-heading">
              <div>
                <span className="customer-section-label">PEÇAS</span>
                <h2>Materiais</h2>
              </div>
              <strong>{money(partsTotal)}</strong>
            </div>

            <div className="customer-parts-table">
              <div className="customer-parts-head">
                <span>Item</span>
                <span>Qtd.</span>
                <span>Unitário</span>
                <span>Total</span>
              </div>

              {items.map((item, index) => (
                <div key={item.id} className="customer-part-row">
                  <div>
                    <span className="customer-part-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{item.description}</strong>
                      <small>
                        {[item.category, item.side, item.specification]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </div>
                  </div>
                  <span>
                    {number(item.quantity)} {item.unit}
                  </span>
                  <strong>{money(item.sale_unit_amount ?? 0)}</strong>
                  <strong>{money(item.sale_total_amount ?? 0)}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="customer-quote-totals">
          <div>
            <span>Mão de obra</span>
            <strong>{money(laborTotal)}</strong>
          </div>
          <div>
            <span>Peças</span>
            <strong>{money(partsTotal)}</strong>
          </div>
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>

          {discount > 0 ? (
            <div className="customer-quote-discount">
              <span>Desconto</span>
              <strong>- {money(discount)}</strong>
            </div>
          ) : null}

          <div className="customer-quote-grand-total">
            <span>TOTAL</span>
            <strong>{money(finalAmount)}</strong>
          </div>
        </section>

        <footer className="customer-quote-footer">
          <p>
            {workshop.default_quote_notes ??
              "Valores sujeitos à disponibilidade das peças e à confirmação dos serviços pela oficina."}
          </p>
        </footer>
      </article>
    </div>
  );
}
