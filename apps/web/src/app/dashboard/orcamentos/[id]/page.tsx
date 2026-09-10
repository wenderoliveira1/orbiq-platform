import Link from "next/link";
import { notFound } from "next/navigation";

import { ReopenLockedQuote } from "../../_components/reopen-locked-quote";
import { getCurrentContext } from "../../_lib/current-organization";
import { hasPermissionForRole } from "../../_lib/permissions";
import { QUOTE_STATUSES } from "../quote-meta";
import {
  addQuoteServiceAction,
  deleteQuoteServiceAction,
  updateQuoteIdentityAction,
  updateQuoteItemQuantityAction,
  updateQuoteNotesAction,
  updateQuoteServiceLaborAction,
  updateQuoteServiceQuantityAction,
  updateQuoteStatusAction,
} from "./actions";
import { PrintButton } from "./print-button";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

const money = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const qty = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);

export default async function QuoteDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, organization, membership } = await getCurrentContext();
  const canReopenCommercial = hasPermissionForRole(membership.role, "commercial.manage");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, customer_id, vehicle_id, protocol, priority, status, commercial_status, mileage, notes, final_amount, created_at")
    .eq("organization_id", organization.id)
    .eq("id", id)
    .maybeSingle();

  if (quoteError) throw new Error(`Falha ao carregar orçamento: ${quoteError.message}`);
  if (!quote) notFound();

  const [customerResult, vehicleResult, servicesResult, itemsResult] = await Promise.all([
    supabase.from("customers").select("id, name, phone, email").eq("organization_id", organization.id).eq("id", quote.customer_id).maybeSingle(),
    supabase.from("vehicles").select("id, plate, brand, model, version, model_year").eq("organization_id", organization.id).eq("id", quote.vehicle_id).maybeSingle(),
    supabase.from("quote_services").select("id, category, description, needs_part, quantity, labor_amount, created_at").eq("organization_id", organization.id).eq("quote_id", quote.id).order("created_at", { ascending: true }),
    supabase.from("quote_items").select("id, category, description, quantity, unit, side, specification, purchase_status, chosen_amount, created_at").eq("organization_id", organization.id).eq("quote_id", quote.id).order("created_at", { ascending: true }),
  ]);

  if (customerResult.error) throw new Error(`Falha ao carregar cliente: ${customerResult.error.message}`);
  if (vehicleResult.error) throw new Error(`Falha ao carregar veículo: ${vehicleResult.error.message}`);
  if (servicesResult.error) throw new Error(`Falha ao carregar serviços: ${servicesResult.error.message}`);
  if (itemsResult.error) throw new Error(`Falha ao carregar peças: ${itemsResult.error.message}`);

  const customer = customerResult.data;
  const vehicle = vehicleResult.data;
  const services = servicesResult.data ?? [];
  const items = itemsResult.data ?? [];
  const laborTotal = Math.round(
    services.reduce((sum, service) => sum + (service.labor_amount ?? 0) * (service.quantity ?? 1), 0) * 100,
  ) / 100;
  const partsTotal = items.reduce((sum, item) => sum + (item.chosen_amount ?? 0), 0);
  const finalTotal = Math.round((laborTotal + partsTotal) * 100) / 100;
  const locked = quote.commercial_status === "approved";

  return (
    <div className="orbiq-page quote-detail-page">
      <div className="print-header">
        <strong>{organization.name}</strong>
        <span>Orbiq <small>ORÇAMENTO</small></span>
      </div>

      <section className="quote-detail-heading">
        <div className="quote-detail-back no-print"><Link href="/dashboard/orcamentos">← Orçamentos</Link></div>
        <div className="quote-detail-actions no-print">
          <PrintButton />
          <Link href="/dashboard/orcamentos/novo" className="orbiq-primary-button">+ Novo orçamento</Link>
        </div>
      </section>

      {query.ok ? <div className="orbiq-alert success no-print">{query.ok}</div> : null}
      {query.error ? <div className="orbiq-alert error no-print">{query.error}</div> : null}

      {locked ? (
        <section className="quote-locked-banner no-print">
          <div>
            <span className="orbiq-eyebrow">ORÇAMENTO BLOQUEADO</span>
            <strong>Aprovado no comercial — edição pausada</strong>
            <span>
              Este orçamento pode já ter sido enviado ao cliente. Para alterar
              cliente, veículo, serviços, quantidades ou valores, reabra o mesmo
              orçamento com confirmação explícita.
            </span>
          </div>
          <div className="quote-locked-banner-actions">
            {canReopenCommercial ? (
              <ReopenLockedQuote
                quoteId={quote.id}
                returnTo="orcamentos"
                buttonLabel="Reabrir para editar"
              />
            ) : (
              <span className="quote-locked-banner-hint">
                Peça a um usuário do comercial para reabrir.
              </span>
            )}
            <Link href={`/dashboard/comercial/${quote.id}`} className="orbiq-secondary-button">
              Ver comercial
            </Link>
          </div>
        </section>
      ) : null}

      <section className="quote-detail-grid">
        <article className="orbiq-panel">
          <span className="orbiq-eyebrow">CLIENTE</span>
          {locked || !customer ? (
            <>
              <h2>{customer?.name ?? "Cliente não localizado"}</h2>
              <div className="quote-detail-info"><span>Telefone</span><strong>{customer?.phone ?? "—"}</strong><span>E-mail</span><strong>{customer?.email ?? "—"}</strong></div>
            </>
          ) : (
            <>
              <div className="print-only">
                <h2>{customer.name}</h2>
                <div className="quote-detail-info"><span>Telefone</span><strong>{customer.phone ?? "—"}</strong><span>E-mail</span><strong>{customer.email ?? "—"}</strong></div>
              </div>
              <form action={updateQuoteIdentityAction} className="no-print quote-identity-form">
                <input type="hidden" name="quote_id" value={quote.id} />
                <input type="hidden" name="customer_id" value={customer.id} />
                <input type="hidden" name="section" value="customer" />
                <label>
                  <span>Nome</span>
                  <input name="customer_name" defaultValue={customer.name} required maxLength={180} aria-label="Nome do cliente" />
                </label>
                <div className="quote-identity-row">
                  <label>
                    <span>Telefone</span>
                    <input name="customer_phone" defaultValue={customer.phone ?? ""} maxLength={40} aria-label="Telefone do cliente" />
                  </label>
                  <label>
                    <span>E-mail</span>
                    <input name="customer_email" type="email" defaultValue={customer.email ?? ""} maxLength={180} aria-label="E-mail do cliente" style={{ textTransform: "none" }} />
                  </label>
                </div>
                <button type="submit" className="orbiq-secondary-button">Salvar cliente</button>
              </form>
            </>
          )}
        </article>
        <article className="orbiq-panel">
          <span className="orbiq-eyebrow">VEÍCULO</span>
          {locked || !vehicle ? (
            <>
              <div className="quote-detail-vehicle-title"><span className="orbiq-plate">{vehicle?.plate ?? "—"}</span><h2>{[vehicle?.brand, vehicle?.model, vehicle?.version].filter(Boolean).join(" ") || "Veículo"}</h2></div>
              <div className="quote-detail-info"><span>Ano</span><strong>{vehicle?.model_year ?? "—"}</strong><span>Quilometragem</span><strong>{quote.mileage !== null ? `${new Intl.NumberFormat("pt-BR").format(quote.mileage)} km` : "—"}</strong></div>
            </>
          ) : (
            <>
              <div className="print-only">
                <div className="quote-detail-vehicle-title"><span className="orbiq-plate">{vehicle.plate}</span><h2>{[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ") || "Veículo"}</h2></div>
                <div className="quote-detail-info"><span>Ano</span><strong>{vehicle.model_year ?? "—"}</strong><span>Quilometragem</span><strong>{quote.mileage !== null ? `${new Intl.NumberFormat("pt-BR").format(quote.mileage)} km` : "—"}</strong></div>
              </div>
              <form action={updateQuoteIdentityAction} className="no-print quote-identity-form">
                <input type="hidden" name="quote_id" value={quote.id} />
                <input type="hidden" name="vehicle_id" value={vehicle.id} />
                <input type="hidden" name="section" value="vehicle" />
                <div className="quote-identity-row">
                  <label>
                    <span>Placa</span>
                    <input name="plate" defaultValue={vehicle.plate} required maxLength={8} aria-label="Placa do veículo" />
                  </label>
                  <label>
                    <span>Km</span>
                    <input name="mileage" inputMode="numeric" defaultValue={quote.mileage ?? ""} required maxLength={10} aria-label="Quilometragem" />
                  </label>
                  <label>
                    <span>Ano</span>
                    <input name="model_year" inputMode="numeric" defaultValue={vehicle.model_year ?? ""} maxLength={4} aria-label="Ano do veículo" />
                  </label>
                </div>
                <div className="quote-identity-row">
                  <label>
                    <span>Marca</span>
                    <input name="brand" defaultValue={vehicle.brand ?? ""} maxLength={80} aria-label="Marca do veículo" />
                  </label>
                  <label>
                    <span>Modelo</span>
                    <input name="model" defaultValue={vehicle.model ?? ""} required maxLength={80} aria-label="Modelo do veículo" />
                  </label>
                  <label>
                    <span>Versão</span>
                    <input name="version" defaultValue={vehicle.version ?? ""} maxLength={120} aria-label="Versão do veículo" />
                  </label>
                </div>
                <button type="submit" className="orbiq-secondary-button">Salvar veículo</button>
              </form>
            </>
          )}
        </article>
      </section>

      <section className="orbiq-panel no-print">
        <div className="orbiq-panel-heading"><div><span className="orbiq-eyebrow">ANDAMENTO</span><h2>Status do orçamento</h2></div></div>
        {locked ? (
          <p className="quote-locked-inline">Status bloqueado enquanto o comercial estiver aprovado.</p>
        ) : (
          <form action={updateQuoteStatusAction} className="quote-status-form">
            <input type="hidden" name="quote_id" value={quote.id} />
            <select name="status" defaultValue={quote.status}>{QUOTE_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
            <button type="submit" className="orbiq-primary-button">Atualizar status</button>
          </form>
        )}
      </section>

      <section className="orbiq-panel">
        <div className="orbiq-panel-heading">
          <div><span className="orbiq-eyebrow">SERVIÇOS</span><h2>Serviços solicitados</h2></div>
          <span className="orbiq-count-badge">{services.length}</span>
        </div>

        {!locked ? (
          <div className="no-print" style={{ marginBottom: 16 }}>
            <form action={addQuoteServiceAction} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input name="category" placeholder="Categoria" aria-label="Categoria do serviço" style={{ flex: "0 1 150px", minHeight: 42, padding: "0 10px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }} />
              <input name="description" placeholder="Novo serviço" aria-label="Descrição do serviço" required style={{ flex: "1 1 240px", minHeight: 42, padding: "0 10px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }} />
              <input name="labor_amount" type="number" min="0" step="0.01" placeholder="Mão de obra unitária (R$)" aria-label="Valor unitário da mão de obra" style={{ flex: "0 1 170px", minHeight: 42, padding: "0 10px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }} />
              <input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" placeholder="Qtd." aria-label="Quantidade do serviço" style={{ flex: "0 1 95px", minHeight: 42, padding: "0 10px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 11 }}><input name="needs_part" type="checkbox" /> Peça?</label>
              <button type="submit" className="orbiq-primary-button">+ Adicionar serviço</button>
            </form>
          </div>
        ) : null}

        {services.length === 0 ? (
          <div className="orbiq-empty compact"><strong>Nenhum serviço registrado.</strong></div>
        ) : (
          <div className="quote-detail-table">
            <div className="quote-detail-table-head service-table" style={{ gridTemplateColumns: "1fr 2fr 200px 70px 120px 120px 90px" }}><span>Categoria</span><span>Serviço</span><span>Qtd.</span><span>Peça?</span><span>Valor unit.</span><span>Total</span><span>Ação</span></div>
            {services.map((service) => {
              const quantity = service.quantity ?? 1;
              const unitLabor = service.labor_amount ?? 0;
              const lineTotal = unitLabor * quantity;
              return (
                <div key={service.id} className="quote-detail-table-row service-table" style={{ gridTemplateColumns: "1fr 2fr 200px 70px 120px 120px 90px" }}>
                  <span>{service.category}</span>
                  <strong>{service.description}</strong>
                  <div>
                    {locked ? (
                      <span>{qty(quantity)}</span>
                    ) : (
                      <>
                        <span className="print-only">{qty(quantity)}</span>
                        <form action={updateQuoteServiceQuantityAction} className="no-print" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <input type="hidden" name="quote_id" value={quote.id} />
                          <input type="hidden" name="service_id" value={service.id} />
                          <input
                            name="quantity"
                            type="number"
                            min="0.001"
                            step="0.001"
                            max="100000"
                            defaultValue={quantity}
                            aria-label={`Quantidade de ${service.description}`}
                            required
                            style={{ width: 78, minHeight: 40, padding: "0 8px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }}
                          />
                          <button type="submit" className="orbiq-secondary-button" style={{ minHeight: 40 }}>Salvar qtd.</button>
                        </form>
                      </>
                    )}
                  </div>
                  <span>{service.needs_part ? "Sim" : "Não"}</span>
                  <div>
                    {locked ? (
                      <span>{money(unitLabor)}</span>
                    ) : (
                      <>
                        <span className="print-only">{money(unitLabor)}</span>
                        <form action={updateQuoteServiceLaborAction} className="no-print" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <input type="hidden" name="quote_id" value={quote.id} />
                          <input type="hidden" name="service_id" value={service.id} />
                          <input
                            name="labor_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            max="1000000"
                            defaultValue={unitLabor}
                            aria-label={`Mão de obra unitária de ${service.description}`}
                            required
                            style={{ width: 90, minHeight: 40, padding: "0 8px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }}
                          />
                          <button type="submit" className="orbiq-secondary-button" style={{ minHeight: 40 }}>Salvar</button>
                        </form>
                      </>
                    )}
                  </div>
                  <strong>{money(lineTotal)}</strong>
                  {locked ? (
                    <span className="no-print">—</span>
                  ) : (
                    <form action={deleteQuoteServiceAction} className="no-print">
                      <input type="hidden" name="quote_id" value={quote.id} />
                      <input type="hidden" name="service_id" value={service.id} />
                      <button type="submit" className="orbiq-secondary-button">Excluir</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {items.length > 0 ? (
        <section className="orbiq-panel quote-items-section">
          <div className="orbiq-panel-heading"><div><span className="orbiq-eyebrow">PEÇAS / ITENS</span><h2>Itens para compra</h2></div><span className="orbiq-count-badge">{items.length}</span></div>
          <div className="quote-detail-table">
            <div className="quote-detail-table-head item-table" style={{ gridTemplateColumns: "1.7fr 220px 130px 1fr 100px" }}><span>Peça</span><span>Qtd.</span><span>Lado</span><span>Especificação</span><span>Compra</span></div>
            {items.map((item) => (
              <div key={item.id} className="quote-detail-table-row item-table" style={{ gridTemplateColumns: "1.7fr 220px 130px 1fr 100px" }}>
                <div><strong>{item.description}</strong><span>{item.category}</span></div>
                <div>
                  {locked ? (
                    <span>{qty(item.quantity)} {item.unit}</span>
                  ) : (
                    <>
                      <span className="print-only">{qty(item.quantity)} {item.unit}</span>
                      <form action={updateQuoteItemQuantityAction} className="no-print" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <input type="hidden" name="quote_id" value={quote.id} />
                        <input type="hidden" name="item_id" value={item.id} />
                        <input
                          name="quantity"
                          type="number"
                          min="0.001"
                          step="0.001"
                          max="100000"
                          defaultValue={item.quantity}
                          aria-label={`Quantidade de ${item.description}`}
                          required
                          style={{ width: 78, minHeight: 40, padding: "0 8px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }}
                        />
                        <span style={{ fontSize: 10 }}>{item.unit}</span>
                        <button type="submit" className="orbiq-secondary-button" style={{ minHeight: 40 }}>Salvar qtd.</button>
                      </form>
                    </>
                  )}
                </div>
                <span>{item.side ?? "—"}</span>
                <span>{item.specification ?? "—"}</span>
                <span>{item.purchase_status}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="orbiq-panel">
        <span className="orbiq-eyebrow">OBSERVAÇÕES</span>
        <p className="quote-detail-notes print-only">{quote.notes || "—"}</p>
        {locked ? (
          <p className="quote-detail-notes no-print">{quote.notes || "—"}</p>
        ) : (
          <form action={updateQuoteNotesAction} className="no-print" style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input type="hidden" name="quote_id" value={quote.id} />
            <textarea
              name="notes"
              rows={4}
              defaultValue={quote.notes ?? ""}
              placeholder="Observações do orçamento..."
              aria-label="Observações do orçamento"
              style={{ width: "100%", padding: 10, border: "1px solid var(--orbiq-border)", borderRadius: 11, resize: "vertical" }}
            />
            <button type="submit" className="orbiq-secondary-button" style={{ justifySelf: "start" }}>Salvar observações</button>
          </form>
        )}
      </section>

      <section className="quote-detail-totals">
        <div><span>Mão de obra</span><strong>{money(laborTotal)}</strong></div>
        {items.length > 0 ? <div><span>Peças escolhidas</span><strong>{money(partsTotal)}</strong></div> : null}
        <div className="main-total"><span>Valor final</span><strong>{money(finalTotal)}</strong></div>
      </section>

      <section className="quote-detail-footer no-print"><Link href="/dashboard/orcamentos" className="orbiq-secondary-button">Voltar ao histórico</Link><Link href="/dashboard/orcamentos/novo" className="orbiq-primary-button">Realizar novo orçamento</Link></section>
      <div className="print-footer"><span>{organization.name}</span><strong>Orbiq</strong><span>{quote.protocol}</span></div>
    </div>
  );
}
