import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmSubmitButton } from "../../_components/confirm-submit-button";
import { ReopenLockedQuote } from "../../_components/reopen-locked-quote";
import { getCurrentContext } from "../../_lib/current-organization";
import { hasPermissionForRole } from "../../_lib/permissions";
import { QUOTE_STATUSES } from "../quote-meta";
import {
  addQuoteItemAction,
  addQuoteServiceAction,
  deleteQuoteItemAction,
  deleteQuoteServiceAction,
  duplicateQuoteAction,
  updateQuoteIdentityAction,
  updateQuoteItemDescriptionAction,
  updateQuoteItemPriceAction,
  updateQuoteItemQuantityAction,
  updateQuoteNotesAction,
  updateQuoteServiceDescriptionAction,
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

  const [customerResult, vehicleResult, servicesResult, itemsResult, catalogResult] = await Promise.all([
    supabase.from("customers").select("id, name, phone, email").eq("organization_id", organization.id).eq("id", quote.customer_id).maybeSingle(),
    supabase.from("vehicles").select("id, plate, brand, model, version, model_year").eq("organization_id", organization.id).eq("id", quote.vehicle_id).maybeSingle(),
    supabase.from("quote_services").select("id, category, description, needs_part, quantity, labor_amount, created_at").eq("organization_id", organization.id).eq("quote_id", quote.id).order("created_at", { ascending: true }),
    supabase.from("quote_items").select("id, category, description, quantity, unit, side, specification, purchase_status, chosen_amount, sale_unit_amount, sale_total_amount, created_at").eq("organization_id", organization.id).eq("quote_id", quote.id).order("created_at", { ascending: true }),
    supabase.from("service_catalog").select("id, category, description, default_labor_amount, requires_part").eq("organization_id", organization.id).eq("active", true).order("category", { ascending: true }).order("description", { ascending: true }).limit(400),
  ]);

  if (customerResult.error) throw new Error(`Falha ao carregar cliente: ${customerResult.error.message}`);
  if (vehicleResult.error) throw new Error(`Falha ao carregar veículo: ${vehicleResult.error.message}`);
  if (servicesResult.error) throw new Error(`Falha ao carregar serviços: ${servicesResult.error.message}`);
  if (itemsResult.error) throw new Error(`Falha ao carregar peças: ${itemsResult.error.message}`);
  if (catalogResult.error) throw new Error(`Falha ao carregar catálogo: ${catalogResult.error.message}`);

  const customer = customerResult.data;
  const vehicle = vehicleResult.data;
  const services = servicesResult.data ?? [];
  const items = itemsResult.data ?? [];
  const serviceCatalog = catalogResult.data ?? [];
  const laborTotal = Math.round(
    services.reduce((sum, service) => sum + (service.labor_amount ?? 0) * (service.quantity ?? 1), 0) * 100,
  ) / 100;
  // Custo interno (oficina). Nunca usar na impressão voltada ao cliente.
  const partsCostTotal = items.reduce((sum, item) => sum + (item.chosen_amount ?? 0), 0);
  const partsSaleTotal = items.reduce((sum, item) => sum + (item.sale_total_amount ?? 0), 0);
  const saleSubtotal = Math.round((laborTotal + partsSaleTotal) * 100) / 100;
  const finalTotal = Math.round((laborTotal + partsCostTotal) * 100) / 100;
  const printGrandTotal =
    quote.final_amount !== null && quote.final_amount !== undefined
      ? Number(quote.final_amount)
      : saleSubtotal;
  const locked = quote.commercial_status === "approved";
  const hasClientSalePrices = items.some(
    (item) => item.sale_total_amount !== null && item.sale_total_amount !== undefined,
  );

  return (
    <div className="orbiq-page quote-detail-page">
      <div className="print-header">
        <strong>{organization.name}</strong>
        <span>Orbiq <small>ORÇAMENTO</small></span>
      </div>

      <section className="quote-detail-heading">
        <div className="quote-detail-back no-print"><Link href="/dashboard/orcamentos">← Orçamentos</Link></div>
        <div className="quote-detail-actions no-print">
          {quote.commercial_status !== "draft" && quote.final_amount !== null ? (
            <Link
              href={`/dashboard/comercial/${quote.id}/cliente`}
              className="orbiq-primary-button"
              data-testid="quote-detail-client-print"
            >
              Versão do cliente / Imprimir
            </Link>
          ) : (
            <PrintButton />
          )}
          <form action={duplicateQuoteAction}>
            <input type="hidden" name="quote_id" value={quote.id} />
            <button type="submit" className="orbiq-secondary-button">Duplicar</button>
          </form>
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
          <div className="no-print quote-append-panel">
            <form action={addQuoteServiceAction} className="quote-append-form">
              <input type="hidden" name="quote_id" value={quote.id} />
              <select name="service_catalog_id" aria-label="Serviço do catálogo" defaultValue="">
                <option value="">Catálogo (opcional)</option>
                {serviceCatalog.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.category} — {service.description}
                  </option>
                ))}
              </select>
              <input name="category" placeholder="Categoria" aria-label="Categoria do serviço" />
              <input name="description" placeholder="Ou descreva o serviço" aria-label="Descrição do serviço" />
              <input name="labor_amount" type="number" min="0" step="0.01" placeholder="MO unit. (R$)" aria-label="Valor unitário da mão de obra" />
              <input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" placeholder="Qtd." aria-label="Quantidade do serviço" />
              <label className="quote-append-check"><input name="needs_part" type="checkbox" /> Peça?</label>
              <button type="submit" className="orbiq-primary-button">+ Serviço</button>
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
                  <div>
                    {locked ? (
                      <strong>{service.description}</strong>
                    ) : (
                      <>
                        <strong className="print-only">{service.description}</strong>
                        <form action={updateQuoteServiceDescriptionAction} className="no-print" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <input type="hidden" name="quote_id" value={quote.id} />
                          <input type="hidden" name="service_id" value={service.id} />
                          <input
                            name="description"
                            defaultValue={service.description}
                            maxLength={300}
                            required
                            aria-label={`Descrição de ${service.description}`}
                            style={{ flex: "1 1 160px", minWidth: 140, minHeight: 40, padding: "0 8px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }}
                          />
                          <button type="submit" className="orbiq-secondary-button" style={{ minHeight: 40 }}>Salvar</button>
                        </form>
                      </>
                    )}
                  </div>
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
                      <ConfirmSubmitButton
                        className="orbiq-secondary-button"
                        message={`Remover o serviço "${service.description}" deste orçamento?`}
                        data-testid="quote-remove-service"
                      >
                        Remover
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(!locked || items.length > 0) ? (
        <section className="orbiq-panel quote-items-section">
          <div className="orbiq-panel-heading"><div><span className="orbiq-eyebrow">PEÇAS / ITENS</span><h2>Itens para compra</h2></div><span className="orbiq-count-badge">{items.length}</span></div>
          {!locked ? (
            <>
              <p className="quote-builder-section-description no-print" style={{ marginTop: 0 }}>
                Sem preço no atendimento? Informe custo unitário e venda (opcional) aqui — mesmo caminho do Comercial / Preço direto. Após aprovação comercial, use Reabrir com &quot;sim&quot;.
              </p>
              <div className="no-print quote-append-panel">
                <form action={addQuoteItemAction} className="quote-append-form quote-append-item-form">
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <input name="description" placeholder="Nova peça / serviço avulso" aria-label="Descrição da peça" required maxLength={300} />
                  <input name="category" placeholder="Categoria" aria-label="Categoria da peça" maxLength={80} />
                  <input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" placeholder="Qtd." aria-label="Quantidade da peça" />
                  <input name="unit" placeholder="UN" defaultValue="UN" aria-label="Unidade" maxLength={40} />
                  <input name="side" placeholder="Lado" aria-label="Lado" maxLength={80} />
                  <input name="specification" placeholder="Especificação" aria-label="Especificação" maxLength={300} />
                  <input name="chosen_amount" type="number" min="0" step="0.01" placeholder="Custo total (opc.)" aria-label="Custo total da peça" />
                  <button type="submit" className="orbiq-primary-button">+ Peça</button>
                </form>
              </div>
            </>
          ) : null}

          {items.length === 0 ? (
            <div className="orbiq-empty compact"><strong>Nenhuma peça registrada.</strong></div>
          ) : (
            <div className="quote-detail-table">
              <div className="quote-detail-table-head item-table quote-item-price-grid"><span>Peça</span><span>Qtd.</span><span>Lado</span><span>Preço</span><span className="no-print quote-internal-economics">Compra</span><span className="no-print">Ação</span></div>
              {items.map((item) => {
                const quantity = Number(item.quantity ?? 1) || 1;
                const unitCost =
                  item.chosen_amount !== null && quantity > 0
                    ? Math.round((Number(item.chosen_amount) / quantity) * 100) / 100
                    : null;
                const saleUnit = item.sale_unit_amount !== null && item.sale_unit_amount !== undefined
                  ? Number(item.sale_unit_amount)
                  : null;
                return (
                <div key={item.id} className="quote-detail-table-row item-table quote-item-price-grid">
                  <div>
                    {locked ? (
                      <>
                        <strong>{item.description}</strong>
                        <span>{item.category}{item.specification ? ` · ${item.specification}` : ""}</span>
                      </>
                    ) : (
                      <>
                        <div className="print-only"><strong>{item.description}</strong><span>{item.category}{item.specification ? ` · ${item.specification}` : ""}</span></div>
                        <form action={updateQuoteItemDescriptionAction} className="no-print" style={{ display: "grid", gap: 6 }}>
                          <input type="hidden" name="quote_id" value={quote.id} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <input
                              name="description"
                              defaultValue={item.description}
                              maxLength={300}
                              required
                              aria-label={`Descrição de ${item.description}`}
                              style={{ flex: "1 1 160px", minWidth: 140, minHeight: 40, padding: "0 8px", border: "1px solid var(--orbiq-border)", borderRadius: 11 }}
                            />
                            <button type="submit" className="orbiq-secondary-button" style={{ minHeight: 40 }}>Salvar</button>
                          </div>
                          <span>{item.category}{item.specification ? ` · ${item.specification}` : ""}</span>
                        </form>
                      </>
                    )}
                  </div>
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
                  <div>
                    {locked ? (
                      <>
                        <div className="quote-item-price-readonly no-print quote-internal-economics">
                          <strong>{money(item.chosen_amount)}</strong>
                          <small>Custo linha{saleUnit !== null ? ` · Venda unit. ${money(saleUnit)}` : ""}</small>
                        </div>
                        <div className="print-only quote-item-price-readonly quote-client-sale">
                          <strong>{money(item.sale_total_amount)}</strong>
                          <small>
                            {saleUnit !== null
                              ? `Venda unit. ${money(saleUnit)}`
                              : "Venda"}
                          </small>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="print-only quote-item-price-readonly quote-client-sale">
                          <strong>{money(item.sale_total_amount)}</strong>
                          <small>
                            {saleUnit !== null
                              ? `Venda unit. ${money(saleUnit)}`
                              : "Sem venda definida"}
                          </small>
                        </div>
                        <form action={updateQuoteItemPriceAction} className="no-print quote-item-price-form quote-internal-economics" data-testid="quote-item-price-form">
                          <input type="hidden" name="quote_id" value={quote.id} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <label>
                            <span>Custo unit. R$</span>
                            <input
                              name="cost_unit_amount"
                              inputMode="decimal"
                              defaultValue={unitCost !== null ? String(unitCost).replace(".", ",") : ""}
                              placeholder="0,00"
                              aria-label={`Custo unitário de ${item.description}`}
                            />
                          </label>
                          <label>
                            <span>Venda unit. (opc.)</span>
                            <input
                              name="sale_unit_amount"
                              inputMode="decimal"
                              defaultValue={saleUnit !== null ? String(saleUnit).replace(".", ",") : ""}
                              placeholder="Margem no Comercial"
                              aria-label={`Venda unitária de ${item.description}`}
                            />
                          </label>
                          <button type="submit" className="orbiq-secondary-button">Salvar preço</button>
                          <small>{item.chosen_amount !== null ? `Linha: ${money(item.chosen_amount)}` : "Sem preço — será cotado"}</small>
                        </form>
                      </>
                    )}
                  </div>
                  <span className="no-print quote-internal-economics">{item.purchase_status}</span>
                  {locked ? (
                    <span className="no-print">—</span>
                  ) : (
                    <form action={deleteQuoteItemAction} className="no-print">
                      <input type="hidden" name="quote_id" value={quote.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <ConfirmSubmitButton
                        className="orbiq-secondary-button"
                        message={`Remover a peça "${item.description}" deste orçamento?`}
                        data-testid="quote-remove-item"
                      >
                        Remover
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>
                );
              })}
            </div>
          )}
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
        {items.length > 0 ? (
          <>
            <div className="no-print quote-internal-economics">
              <span>Peças (custo interno)</span>
              <strong>{money(partsCostTotal)}</strong>
            </div>
            <div className="print-only quote-client-sale">
              <span>Peças</span>
              <strong>{money(partsSaleTotal)}</strong>
            </div>
            {hasClientSalePrices ? (
              <div className="no-print">
                <span>Peças (venda)</span>
                <strong>{money(partsSaleTotal)}</strong>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="main-total no-print quote-internal-economics">
          <span>Valor final (interno)</span>
          <strong>{money(finalTotal)}</strong>
        </div>
        <div className="main-total print-only quote-client-sale">
          <span>Total a pagar</span>
          <strong>{money(printGrandTotal)}</strong>
        </div>
      </section>

      <section className="quote-detail-footer no-print"><Link href="/dashboard/orcamentos" className="orbiq-secondary-button">Voltar ao histórico</Link><Link href="/dashboard/orcamentos/novo" className="orbiq-primary-button">Realizar novo orçamento</Link></section>
      <div className="print-footer"><span>{organization.name}</span><strong>Orbiq</strong><span>{quote.protocol}</span></div>
    </div>
  );
}
