"use client";

import { useMemo, useState, useTransition } from "react";
import { createQuoteV2Action, saveServiceLaborAction } from "./actions";

type Customer = { id: string; name: string; phone: string | null };
type Vehicle = { id: string; customer_id: string; plate: string; brand: string | null; model: string | null; version: string | null; model_year: number | null; mileage: number | null };
type LaborService = { id: string; description: string; category: string | null; amount: number };
type ServiceCatalogItem = { id: string; category: string; description: string; default_labor_amount: number };
type SelectedService = { key: string; serviceCatalogId: string | null; category: string; description: string; laborAmount: number; needsPart: boolean; partDescription: string; partCategory: string; partQuantity: string; partUnit: string; partSide: string; partSpecification: string };
type ExtraItem = { key: string; category: string; description: string; quantity: string; unit: string; side: string; specification: string };
type Props = { customers: Customer[]; vehicles: Vehicle[]; laborServices: LaborService[]; serviceCatalog: ServiceCatalogItem[]; errorMessage?: string };

const serviceCategories = ["Mecânica", "Suspensão", "Freios", "Direção", "Motor", "Câmbio", "Elétrica", "Arrefecimento", "Ar-condicionado", "Funilaria", "Pintura", "Alinhamento", "Outros"];
const itemCategories = ["Mecânica", "Chassi - Paralelo/Original", "Chassi - Ferro Velho", "Pneus", "Vidros", "Óleos e Lubrificantes", "Funilaria", "Elétrica", "Outros"];
const units = ["un", "par", "kit", "jogo", "litro", "metro", "pacote"];
const sides = ["", "Esquerdo", "Direito", "Dianteiro", "Traseiro", "Dianteiro esquerdo", "Dianteiro direito", "Traseiro esquerdo", "Traseiro direito"];

function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function parseMoney(raw: string) { let value = raw.trim().replace(/\s/g, ""); if (!value) return 0; if (value.includes(",")) value = value.replace(/\./g, "").replace(",", "."); const result = Number(value); return Number.isFinite(result) ? result : null; }
function parseQuantity(raw: string) { const result = Number(raw.trim().replace(",", ".")); return Number.isFinite(result) && result > 0 ? result : 1; }
function key(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

export function QuoteBuilder({ customers, vehicles, serviceCatalog, errorMessage }: Props) {
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [mileage, setMileage] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualCategory, setManualCategory] = useState("Mecânica");
  const [manualAmount, setManualAmount] = useState("");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("Mecânica");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemUnit, setItemUnit] = useState("un");
  const [itemSide, setItemSide] = useState("");
  const [itemSpecification, setItemSpecification] = useState("");
  const [savingLabor, startSavingLabor] = useTransition();

  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.customer_id === customerId), [vehicles, customerId]);
  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === vehicleId), [vehicles, vehicleId]);
  const availableCategories = useMemo(() => Array.from(new Set([...serviceCategories, ...serviceCatalog.map((service) => service.category)])), [serviceCatalog]);
  const filteredServices = useMemo(() => serviceCategory ? serviceCatalog.filter((service) => service.category === serviceCategory) : [], [serviceCatalog, serviceCategory]);
  const laborTotal = useMemo(() => selectedServices.reduce((total, service) => total + service.laborAmount, 0), [selectedServices]);
  const generatedItems = useMemo(() => selectedServices.filter((service) => service.needsPart).map((service) => ({ category: service.partCategory || "Mecânica", description: service.partDescription.trim(), quantity: parseQuantity(service.partQuantity), unit: service.partUnit || "un", side: service.partSide || null, specification: service.partSpecification.trim() || null, notes: `Gerado pelo serviço: ${service.description}` })), [selectedServices]);
  const extraItemsPayload = useMemo(() => extraItems.map((item) => ({ category: item.category, description: item.description, quantity: parseQuantity(item.quantity), unit: item.unit, side: item.side || null, specification: item.specification || null, notes: null })), [extraItems]);
  const itemsPayload = useMemo(() => [...generatedItems, ...extraItemsPayload], [generatedItems, extraItemsPayload]);
  const servicesPayload = useMemo(() => selectedServices.map((service) => ({ service_catalog_id: service.serviceCatalogId, category: service.category, description: service.description, labor_amount: service.laborAmount, needs_part: service.needsPart })), [selectedServices]);

  function chooseCustomer(id: string) { setCustomerId(id); setVehicleId(""); setMileage(""); }
  function chooseVehicle(id: string) { setVehicleId(id); const vehicle = vehicles.find((item) => item.id === id); setMileage(vehicle?.mileage != null ? String(vehicle.mileage) : ""); }
  function addCatalogService(service: ServiceCatalogItem) {
    const serviceKey = `catalog-${service.id}`;
    if (selectedServices.some((item) => item.key === serviceKey)) return;
    setSelectedServices((current) => [...current, { key: serviceKey, serviceCatalogId: service.id, category: service.category, description: service.description, laborAmount: Number(service.default_labor_amount) || 0, needsPart: false, partDescription: "", partCategory: "Mecânica", partQuantity: "1", partUnit: "un", partSide: "", partSpecification: "" }]);
  }
  function addManualService() {
    const description = manualDescription.trim();
    if (description.length < 2) return window.alert("Informe a descrição do serviço.");
    const amount = parseMoney(manualAmount);
    if (amount === null || amount < 0) return window.alert("Informe um valor de mão de obra válido.");
    setSelectedServices((current) => [...current, { key: key("manual"), serviceCatalogId: null, category: manualCategory, description, laborAmount: amount, needsPart: false, partDescription: "", partCategory: "Mecânica", partQuantity: "1", partUnit: "un", partSide: "", partSpecification: "" }]);
    setManualDescription(""); setManualAmount("");
  }
  function saveLabor(service: SelectedService) {
    if (!service.serviceCatalogId) return;
    startSavingLabor(async () => {
      try { await saveServiceLaborAction(service.serviceCatalogId!, service.laborAmount); } catch { window.alert("Não foi possível salvar a mão de obra."); }
    });
  }
  function patchService(serviceKey: string, patch: Partial<SelectedService>) { setSelectedServices((current) => current.map((service) => service.key === serviceKey ? { ...service, ...patch } : service)); }
  function removeService(serviceKey: string) { setSelectedServices((current) => current.filter((service) => service.key !== serviceKey)); }
  function addExtraItem() {
    const description = itemDescription.trim();
    if (description.length < 2) return window.alert("Informe o nome da peça.");
    setExtraItems((current) => [...current, { key: key("item"), category: itemCategory, description, quantity: itemQuantity || "1", unit: itemUnit || "un", side: itemSide, specification: itemSpecification.trim() }]);
    setItemDescription(""); setItemQuantity("1"); setItemSide(""); setItemSpecification("");
  }
  function removeExtraItem(itemKey: string) { setExtraItems((current) => current.filter((item) => item.key !== itemKey)); }

  const generatedPartMissing = selectedServices.some((service) => service.needsPart && service.partDescription.trim().length < 2);
  const canSave = Boolean(customerId && vehicleId && mileage.trim() && selectedServices.length > 0 && !generatedPartMissing);

  return (
    <form action={createQuoteV2Action} className="quote-builder">
      <input type="hidden" name="services_json" value={JSON.stringify(servicesPayload)} />
      <input type="hidden" name="items_json" value={JSON.stringify(itemsPayload)} />
      {errorMessage ? <div className="orbiq-alert error">{errorMessage}</div> : null}

      <section className="quote-builder-header">
        <div><span className="orbiq-eyebrow">NOVO ORÇAMENTO</span><h1>Atendimento</h1><p>Cliente, veículo, serviços, mão de obra e peças em um único fluxo.</p></div>
        <div className="quote-builder-total"><span>Mão de obra</span><strong>{money(laborTotal)}</strong><small>{selectedServices.length} serviço(s)</small></div>
      </section>

      <section className="orbiq-panel">
        <div className="orbiq-panel-heading"><div><span className="orbiq-eyebrow">1 · ATENDIMENTO</span><h2>Cliente e veículo</h2></div></div>
        <div className="quote-builder-grid">
          <label><span>Cliente *</span><select name="customer_id" value={customerId} onChange={(event) => chooseCustomer(event.target.value)} required><option value="">Selecione o cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
          <label><span>Veículo *</span><select name="vehicle_id" value={vehicleId} onChange={(event) => chooseVehicle(event.target.value)} disabled={!customerId} required><option value="">{customerId ? "Selecione o veículo" : "Selecione primeiro o cliente"}</option>{filteredVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ")}</option>)}</select></label>
          <label><span>Quilometragem *</span><input name="mileage" value={mileage} onChange={(event) => setMileage(event.target.value.replace(/\D/g, ""))} inputMode="numeric" required placeholder="Ex.: 87500" /></label>
        </div>
        {selectedVehicle ? <div className="quote-builder-vehicle-preview"><span className="orbiq-plate">{selectedVehicle.plate}</span><div><strong>{[selectedVehicle.brand, selectedVehicle.model, selectedVehicle.version].filter(Boolean).join(" ")}</strong><span>{selectedVehicle.model_year ? `Ano ${selectedVehicle.model_year}` : "Ano não informado"}</span></div></div> : null}
        <div className="quote-priority-group"><span>Prioridade</span><div><label><input type="radio" name="priority" value="normal" defaultChecked /><strong>Normal</strong><small>Fluxo padrão</small></label><label><input type="radio" name="priority" value="customer_waiting" /><strong>Cliente aguardando</strong><small>Cliente permanece na oficina</small></label><label><input type="radio" name="priority" value="vehicle_stopped" /><strong>Veículo parado</strong><small>Prioridade operacional</small></label></div></div>
      </section>

      <section className="orbiq-panel">
        <div className="orbiq-panel-heading"><div><span className="orbiq-eyebrow">2 · SERVIÇOS</span><h2>Serviços realizados</h2><p className="quote-builder-section-description">Selecione a área e escolha o serviço realizado pelo mecânico. A mão de obra é informada separadamente.</p></div></div>

        <div className="quote-labor-browser">
          <div className="quote-labor-search">
            <select value={serviceCategory} onChange={(event) => setServiceCategory(event.target.value)} aria-label="Área do serviço"><option value="">Selecione a área do serviço</option>{availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
            <span>{filteredServices.length} serviço(s)</span>
          </div>
          {serviceCategory ? <div className="quote-labor-catalog">{filteredServices.map((service) => { const added = selectedServices.some((item) => item.key === `catalog-${service.id}`); return <button key={service.id} type="button" className={`quote-labor-card${added ? " added" : ""}`} disabled={added} onClick={() => addCatalogService(service)}><span>{service.category}</span><strong>{service.description}</strong><b>{Number(service.default_labor_amount) > 0 ? money(Number(service.default_labor_amount)) : "Mão de obra não definida"}</b><small>{added ? "Adicionado" : "+ Adicionar"}</small></button>; })}</div> : <div className="orbiq-empty compact"><strong>Escolha uma área.</strong><span>O Orbiq mostrará somente os serviços daquela área.</span></div>}
        </div>

        <div className="quote-manual-service">
          <div><span className="orbiq-eyebrow">ADICIONAR SERVIÇO</span><strong>Não encontrou na lista?</strong></div>
          <select value={manualCategory} onChange={(event) => setManualCategory(event.target.value)}>{availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
          <input value={manualDescription} onChange={(event) => setManualDescription(event.target.value)} placeholder="Descrição do serviço" />
          <input value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} inputMode="decimal" placeholder="Mão de obra R$" />
          <button type="button" className="orbiq-secondary-button" onClick={addManualService}>+ Adicionar serviço</button>
        </div>

        {selectedServices.length > 0 ? <div className="quote-selected-services"><div className="quote-selected-title"><strong>Serviços selecionados</strong><span>{selectedServices.length}</span></div>{selectedServices.map((service) => <article key={service.key} className="quote-selected-service">
          <div className="quote-selected-service-heading"><div><span className="orbiq-eyebrow">{service.category}</span><h3>{service.description}</h3></div><div className="quote-selected-service-price"><strong>{money(service.laborAmount)}</strong><span>Serviço</span></div><button type="button" className="quote-remove-button" onClick={() => removeService(service.key)} aria-label="Remover serviço">×</button></div>
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}><label style={{ flex: "1 1 180px" }}><span>Mão de obra</span><input value={service.laborAmount.toFixed(2).replace(".", ",")} onChange={(event) => { const parsed = parseMoney(event.target.value); if (parsed !== null) patchService(service.key, { laborAmount: parsed }); }} inputMode="decimal" /></label>{service.serviceCatalogId ? <button type="button" className="orbiq-secondary-button" onClick={() => saveLabor(service)} disabled={savingLabor}>{savingLabor ? "Salvando..." : "Salvar mão de obra"}</button> : <small style={{ paddingBottom: 10 }}>Será salvo como novo serviço ao concluir o orçamento.</small>}</div>
          <label className="quote-needs-part"><input type="checkbox" checked={service.needsPart} onChange={(event) => patchService(service.key, { needsPart: event.target.checked })} /><span><strong>Precisa comprar peça</strong><small>A peça entrará automaticamente na cotação.</small></span></label>
          {service.needsPart ? <div className="quote-service-part-grid"><label><span>Peça *</span><input value={service.partDescription} onChange={(event) => patchService(service.key, { partDescription: event.target.value })} required placeholder="Ex.: Coxim do motor" /></label><label><span>Categoria</span><select value={service.partCategory} onChange={(event) => patchService(service.key, { partCategory: event.target.value })}>{itemCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label><span>Qtd.</span><input value={service.partQuantity} onChange={(event) => patchService(service.key, { partQuantity: event.target.value })} inputMode="decimal" /></label><label><span>Unidade</span><select value={service.partUnit} onChange={(event) => patchService(service.key, { partUnit: event.target.value })}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label><label><span>Lado</span><select value={service.partSide} onChange={(event) => patchService(service.key, { partSide: event.target.value })}>{sides.map((side) => <option key={side || "none"} value={side}>{side || "Não se aplica"}</option>)}</select></label><label><span>Especificação</span><input value={service.partSpecification} onChange={(event) => patchService(service.key, { partSpecification: event.target.value })} placeholder="Marca, medida..." /></label></div> : null}
        </article>)}</div> : <div className="quote-builder-empty"><span>+</span><strong>Nenhum serviço selecionado</strong><small>Escolha uma área acima para começar.</small></div>}
      </section>

      <section className="orbiq-panel">
        <div className="orbiq-panel-heading"><div><span className="orbiq-eyebrow">3 · PEÇAS ADICIONAIS</span><h2>Itens para cotação</h2><p className="quote-builder-section-description">Para itens que não vieram diretamente de um serviço.</p></div></div>
        <div className="quote-extra-item-form"><input value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} placeholder="Peça / item" /><select value={itemCategory} onChange={(event) => setItemCategory(event.target.value)}>{itemCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select><input value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} inputMode="decimal" placeholder="Qtd." /><select value={itemUnit} onChange={(event) => setItemUnit(event.target.value)}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select><select value={itemSide} onChange={(event) => setItemSide(event.target.value)}>{sides.map((side) => <option key={side || "none"} value={side}>{side || "Lado: não se aplica"}</option>)}</select><input value={itemSpecification} onChange={(event) => setItemSpecification(event.target.value)} placeholder="Especificação" /><button type="button" onClick={addExtraItem} className="orbiq-secondary-button">+ Peça</button></div>
        {itemsPayload.length > 0 ? <div className="quote-parts-summary">{generatedItems.map((item, index) => <article key={`automatic-${index}`}><div><span className="orbiq-eyebrow">AUTOMÁTICO</span><strong>{item.description || "Peça ainda não informada"}</strong><small>{item.category}</small></div><span>{item.quantity} {item.unit}</span></article>)}{extraItems.map((item) => <article key={item.key}><div><span className="orbiq-eyebrow">ADICIONAL</span><strong>{item.description}</strong><small>{item.category}{item.side ? ` · ${item.side}` : ""}</small></div><span>{item.quantity} {item.unit}</span><button type="button" className="quote-remove-button" onClick={() => removeExtraItem(item.key)}>×</button></article>)}</div> : <div className="quote-builder-empty compact"><strong>Nenhuma peça adicionada.</strong><small>Um orçamento pode conter somente serviços.</small></div>}
      </section>

      <section className="orbiq-panel"><div className="orbiq-panel-heading"><div><span className="orbiq-eyebrow">4 · OBSERVAÇÕES</span><h2>Informações do atendimento</h2></div></div><textarea name="notes" rows={5} className="quote-builder-notes" placeholder="Observações gerais do orçamento..." /></section>

      <section className="quote-builder-finish"><div><span>Serviços</span><strong>{selectedServices.length}</strong></div><div><span>Itens para compra</span><strong>{itemsPayload.length}</strong></div><div><span>Mão de obra</span><strong>{money(laborTotal)}</strong></div><button type="submit" className="orbiq-primary-button quote-save-button" disabled={!canSave}>Salvar orçamento</button></section>
    </form>
  );
}
