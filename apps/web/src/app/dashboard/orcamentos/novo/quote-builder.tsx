"use client";

import { useMemo, useState, useTransition } from "react";
import { createQuoteV2Action, saveServiceCatalogAction, saveServiceLaborAction } from "./actions";

type Customer = { id: string; name: string; phone: string | null };
type Vehicle = { id: string; customer_id: string; plate: string; brand: string | null; model: string | null; version: string | null; model_year: number | null; mileage: number | null };
type ServiceCatalogItem = { id: string; category: string; description: string; default_labor_amount: number; requires_part: boolean };
type SelectedService = { key: string; serviceCatalogId: string | null; category: string; description: string; laborAmount: number; quantity: string; needsPart: boolean; partDescription: string; partCategory: string; partQuantity: string; partUnit: string; partSide: string; partSpecification: string; hasManualPrice: boolean; partCost: string; partSale: string };
type ExtraItem = { key: string; category: string; description: string; quantity: string; unit: string; side: string; specification: string; hasManualPrice: boolean; partCost: string; partSale: string };
type Props = { customers: Customer[]; vehicles: Vehicle[]; serviceCatalog: ServiceCatalogItem[]; errorMessage?: string };
type StepId = 1 | 2 | 3 | 4;

const serviceCategories = ["MECÂNICA", "SUSPENSÃO", "FREIOS", "DIREÇÃO", "MOTOR", "CÂMBIO", "ELÉTRICA", "ARREFECIMENTO", "AR-CONDICIONADO", "FUNILARIA", "PINTURA", "ALINHAMENTO", "OUTROS"];
const itemCategories = ["MECÂNICA", "CHASSI - PARALELO/ORIGINAL", "CHASSI - FERRO VELHO", "PNEUS", "VIDROS", "ÓLEOS E LUBRIFICANTES", "FUNILARIA", "ELÉTRICA", "OUTROS"];
const units = ["UN", "PAR", "KIT", "JOGO", "LITRO", "METRO", "PACOTE"];
const sides = ["", "ESQUERDO", "DIREITO", "DIANTEIRO", "TRASEIRO", "DIANTEIRO ESQUERDO", "DIANTEIRO DIREITO", "TRASEIRO ESQUERDO", "TRASEIRO DIREITO"];
const PICKER_PAGE_SIZE = 40;
const CATALOG_PAGE_SIZE = 24;

function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function parseMoney(raw: string) { let value = raw.trim().replace(/\s/g, ""); if (!value) return 0; if (value.includes(",")) value = value.replace(/\./g, "").replace(",", "."); const result = Number(value); return Number.isFinite(result) ? result : null; }
function parseQuantity(raw: string) { const result = Number(raw.trim().replace(",", ".")); return Number.isFinite(result) && result > 0 ? result : 1; }
function normalizeCategory(value: string) { return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleUpperCase("pt-BR").trim(); }
function key(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

export function QuoteBuilder({ customers, vehicles, serviceCatalog, errorMessage }: Props) {
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [mileage, setMileage] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualCategory, setManualCategory] = useState("MECÂNICA");
  const [manualAmount, setManualAmount] = useState("");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("MECÂNICA");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemUnit, setItemUnit] = useState("UN");
  const [itemSide, setItemSide] = useState("");
  const [itemSpecification, setItemSpecification] = useState("");
  const [saving, startSaving] = useTransition();
  const [openStep, setOpenStep] = useState<StepId>(1);
  const [partDetailsOpen, setPartDetailsOpen] = useState<Record<string, boolean>>({});
  const [extraDetailsOpen, setExtraDetailsOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [customerLimit, setCustomerLimit] = useState(PICKER_PAGE_SIZE);
  const [vehicleLimit, setVehicleLimit] = useState(PICKER_PAGE_SIZE);
  const [serviceLimit, setServiceLimit] = useState(CATALOG_PAGE_SIZE);

  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === customerId), [customers, customerId]);
  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase("pt-BR");
    const digitsQuery = customerQuery.replace(/\D/g, "");
    if (!query) return customers;
    return customers.filter((customer) => {
      const name = customer.name.toLocaleLowerCase("pt-BR");
      const phone = String(customer.phone ?? "");
      const phoneDigits = phone.replace(/\D/g, "");
      return name.includes(query) || phone.toLocaleLowerCase("pt-BR").includes(query) || (digitsQuery.length >= 2 && phoneDigits.includes(digitsQuery));
    });
  }, [customers, customerQuery]);
  const visibleCustomers = useMemo(() => {
    const list = filteredCustomers.slice(0, customerLimit);
    if (selectedCustomer && !list.some((customer) => customer.id === selectedCustomer.id)) {
      return [selectedCustomer, ...list];
    }
    return list;
  }, [filteredCustomers, customerLimit, selectedCustomer]);

  const filteredVehicles = useMemo(() => {
    const owned = vehicles.filter((vehicle) => vehicle.customer_id === customerId);
    const query = vehicleQuery.trim().toLocaleLowerCase("pt-BR");
    if (!query) return owned;
    return owned.filter((vehicle) => {
      const haystack = [vehicle.plate, vehicle.brand, vehicle.model, vehicle.version]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return haystack.includes(query);
    });
  }, [vehicles, customerId, vehicleQuery]);
  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === vehicleId), [vehicles, vehicleId]);
  const visibleVehicles = useMemo(() => {
    const list = filteredVehicles.slice(0, vehicleLimit);
    if (selectedVehicle && selectedVehicle.customer_id === customerId && !list.some((vehicle) => vehicle.id === selectedVehicle.id)) {
      return [selectedVehicle, ...list];
    }
    return list;
  }, [filteredVehicles, vehicleLimit, selectedVehicle, customerId]);

  const availableCategories = useMemo(() => Array.from(new Set([...serviceCategories, ...serviceCatalog.map((service) => service.category.toLocaleUpperCase("pt-BR"))])), [serviceCatalog]);
  const filteredServices = useMemo(() => {
    if (!serviceCategory) return [];
    const byCategory = serviceCatalog.filter((service) => normalizeCategory(service.category) === normalizeCategory(serviceCategory));
    const query = serviceQuery.trim().toLocaleLowerCase("pt-BR");
    if (!query) return byCategory;
    return byCategory.filter((service) => {
      const haystack = `${service.description} ${service.category}`.toLocaleLowerCase("pt-BR");
      return haystack.includes(query);
    });
  }, [serviceCatalog, serviceCategory, serviceQuery]);
  const visibleServices = useMemo(() => filteredServices.slice(0, serviceLimit), [filteredServices, serviceLimit]);
  const laborTotal = useMemo(() => selectedServices.reduce((total, service) => total + service.laborAmount * parseQuantity(service.quantity), 0), [selectedServices]);
  const generatedItems = useMemo(() => selectedServices.filter((service) => service.needsPart).map((service) => {
    const quantity = parseQuantity(service.partQuantity);
    const unitCost = service.hasManualPrice ? parseMoney(service.partCost) : null;
    const saleUnit = service.hasManualPrice ? parseMoney(service.partSale) : null;
    const chosenAmount = unitCost !== null && service.hasManualPrice ? Math.round(unitCost * quantity * 100) / 100 : null;
    return {
      category: service.partCategory || "MECÂNICA",
      description: service.partDescription.trim(),
      quantity,
      unit: service.partUnit || "UN",
      side: service.partSide || null,
      specification: service.partSpecification.trim() || null,
      notes: `GERADO PELO SERVIÇO: ${service.description}`,
      chosen_amount: chosenAmount,
      sale_unit_amount: saleUnit !== null && service.hasManualPrice && service.partSale.trim() ? saleUnit : null,
      has_manual_price: service.hasManualPrice,
    };
  }), [selectedServices]);
  const extraItemsPayload = useMemo(() => extraItems.map((item) => {
    const quantity = parseQuantity(item.quantity);
    const unitCost = item.hasManualPrice ? parseMoney(item.partCost) : null;
    const saleUnit = item.hasManualPrice ? parseMoney(item.partSale) : null;
    const chosenAmount = unitCost !== null && item.hasManualPrice ? Math.round(unitCost * quantity * 100) / 100 : null;
    return {
      category: item.category,
      description: item.description,
      quantity,
      unit: item.unit,
      side: item.side || null,
      specification: item.specification || null,
      notes: null,
      chosen_amount: chosenAmount,
      sale_unit_amount: saleUnit !== null && item.hasManualPrice && item.partSale.trim() ? saleUnit : null,
      has_manual_price: item.hasManualPrice,
    };
  }), [extraItems]);
  const itemsPayload = useMemo(() => [...generatedItems, ...extraItemsPayload], [generatedItems, extraItemsPayload]);
  const servicesPayload = useMemo(() => selectedServices.map((service) => ({ labor_service_id: null, service_catalog_id: service.serviceCatalogId, category: service.category, description: service.description, labor_amount: service.laborAmount, quantity: parseQuantity(service.quantity), needs_part: service.needsPart })), [selectedServices]);

  const step1Ready = Boolean(customerId && vehicleId);
  const step1Complete = Boolean(customerId && vehicleId && mileage.trim());

  function chooseCustomer(id: string) {
    setCustomerId(id);
    setVehicleId("");
    setMileage("");
    setVehicleQuery("");
    setVehicleLimit(PICKER_PAGE_SIZE);
  }
  function chooseVehicle(id: string) {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => item.id === id);
    setMileage(vehicle?.mileage != null ? String(vehicle.mileage) : "");
  }
  function addCatalogService(service: ServiceCatalogItem) {
    const serviceKey = `catalog-${service.id}`;
    if (selectedServices.some((item) => item.key === serviceKey)) return;
    setSelectedServices((current) => [...current, { key: serviceKey, serviceCatalogId: service.id, category: service.category.toLocaleUpperCase("pt-BR"), description: service.description.toLocaleUpperCase("pt-BR"), laborAmount: Number(service.default_labor_amount) || 0, quantity: "1", needsPart: Boolean(service.requires_part), partDescription: service.description.toLocaleUpperCase("pt-BR"), partCategory: "MECÂNICA", partQuantity: "1", partUnit: "UN", partSide: "", partSpecification: "", hasManualPrice: false, partCost: "", partSale: "" }]);
  }
  function addManualService() {
    const description = manualDescription.trim().toLocaleUpperCase("pt-BR");
    if (description.length < 2) return window.alert("INFORME A DESCRIÇÃO DO SERVIÇO.");
    const amount = parseMoney(manualAmount);
    if (amount === null || amount < 0) return window.alert("INFORME UM VALOR DE MÃO DE OBRA VÁLIDO.");
    startSaving(async () => {
      try {
        const id = await saveServiceCatalogAction(manualCategory, description, amount);
        setSelectedServices((current) => [...current, { key: key("manual"), serviceCatalogId: id, category: manualCategory, description, laborAmount: amount, quantity: "1", needsPart: false, partDescription: "", partCategory: "MECÂNICA", partQuantity: "1", partUnit: "UN", partSide: "", partSpecification: "", hasManualPrice: false, partCost: "", partSale: "" }]);
        setServiceCategory(manualCategory); setManualDescription(""); setManualAmount("");
      } catch { window.alert("NÃO FOI POSSÍVEL SALVAR O SERVIÇO NO CATÁLOGO."); }
    });
  }
  function saveLabor(service: SelectedService) {
    if (!service.serviceCatalogId) return;
    startSaving(async () => { try { await saveServiceLaborAction(service.serviceCatalogId!, service.laborAmount); } catch { window.alert("NÃO FOI POSSÍVEL SALVAR A MÃO DE OBRA."); } });
  }
  function patchService(serviceKey: string, patch: Partial<SelectedService>) { setSelectedServices((current) => current.map((service) => service.key === serviceKey ? { ...service, ...patch } : service)); }
  function removeService(serviceKey: string) { setSelectedServices((current) => current.filter((service) => service.key !== serviceKey)); }
  function addExtraItem() {
    const description = itemDescription.trim().toLocaleUpperCase("pt-BR");
    if (description.length < 2) return window.alert("INFORME O NOME DA PEÇA.");
    setExtraItems((current) => [...current, { key: key("item"), category: itemCategory, description, quantity: itemQuantity || "1", unit: itemUnit || "UN", side: itemSide, specification: itemSpecification.trim().toLocaleUpperCase("pt-BR"), hasManualPrice: false, partCost: "", partSale: "" }]);
    setItemDescription(""); setItemQuantity("1"); setItemSide(""); setItemSpecification("");
  }
  function removeExtraItem(itemKey: string) { setExtraItems((current) => current.filter((item) => item.key !== itemKey)); }
  function patchExtraItem(itemKey: string, patch: Partial<ExtraItem>) { setExtraItems((current) => current.map((item) => item.key === itemKey ? { ...item, ...patch } : item)); }

  function toggleStep(step: StepId) {
    setOpenStep((current) => (current === step ? current : step));
  }

  function continueTo(step: StepId) {
    setOpenStep(step);
  }

  function togglePartDetails(serviceKey: string) {
    setPartDetailsOpen((current) => ({ ...current, [serviceKey]: !current[serviceKey] }));
  }

  const generatedPartMissing = selectedServices.some((service) => service.needsPart && service.partDescription.trim().length < 2);
  const manualCostMissing = selectedServices.some((service) => service.needsPart && service.hasManualPrice && (parseMoney(service.partCost) === null || parseMoney(service.partCost)! < 0 || !service.partCost.trim()))
    || extraItems.some((item) => item.hasManualPrice && (parseMoney(item.partCost) === null || parseMoney(item.partCost)! < 0 || !item.partCost.trim()));
  const canSave = Boolean(customerId && vehicleId && mileage.trim() && selectedServices.length > 0 && !generatedPartMissing && !manualCostMissing);

  return (
    <form action={createQuoteV2Action} className="quote-builder">
      <input type="hidden" name="services_json" value={JSON.stringify(servicesPayload)} />
      <input type="hidden" name="items_json" value={JSON.stringify(itemsPayload)} />
      {errorMessage ? <div className="orbiq-alert error">{errorMessage}</div> : null}

      <section className="quote-builder-header">
        <div>
          <span className="orbiq-eyebrow">NOVO ORÇAMENTO</span>
          <h1>Atendimento</h1>
          <p>Um passo de cada vez: cliente, serviços, peças e observações.</p>
        </div>
        <div className="quote-builder-total">
          <span>Mão de obra</span>
          <strong>{money(laborTotal)}</strong>
          <small>{selectedServices.length} serviço(s)</small>
        </div>
      </section>

      <section className={`orbiq-panel quote-step${openStep === 1 ? " is-open" : ""}`}>
        <button type="button" className="quote-step-toggle" aria-expanded={openStep === 1} onClick={() => toggleStep(1)}>
          <div>
            <span className="orbiq-eyebrow">1 · ATENDIMENTO</span>
            <h2>Cliente e veículo</h2>
          </div>
          <span className="quote-step-chevron" aria-hidden="true">{openStep === 1 ? "−" : "+"}</span>
        </button>
        <div className="quote-step-body" hidden={openStep !== 1}>
          <div className="quote-builder-grid">
            <label className="quote-picker-field">
              <span>Cliente *</span>
              <input
                type="search"
                value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  setCustomerLimit(PICKER_PAGE_SIZE);
                }}
                placeholder="Buscar nome ou telefone"
                aria-label="Buscar cliente"
                autoComplete="off"
              />
              <select name="customer_id" value={customerId} onChange={(event) => chooseCustomer(event.target.value)} required>
                <option value="">Selecione o cliente</option>
                {visibleCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}{customer.phone ? ` · ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
              <small className="quote-picker-meta">
                {filteredCustomers.length === 0
                  ? "Nenhum cliente encontrado"
                  : `Mostrando ${Math.min(visibleCustomers.length, filteredCustomers.length)} de ${filteredCustomers.length}`}
                {filteredCustomers.length > customerLimit ? (
                  <button type="button" className="quote-picker-more" onClick={() => setCustomerLimit((current) => current + PICKER_PAGE_SIZE)}>
                    Mostrar mais
                  </button>
                ) : null}
              </small>
            </label>
            <label className="quote-picker-field">
              <span>Veículo *</span>
              <input
                type="search"
                value={vehicleQuery}
                onChange={(event) => {
                  setVehicleQuery(event.target.value);
                  setVehicleLimit(PICKER_PAGE_SIZE);
                }}
                placeholder={customerId ? "Buscar placa ou modelo" : "Selecione o cliente primeiro"}
                aria-label="Buscar veículo"
                disabled={!customerId}
                autoComplete="off"
              />
              <select name="vehicle_id" value={vehicleId} onChange={(event) => chooseVehicle(event.target.value)} disabled={!customerId} required>
                <option value="">{customerId ? "Selecione o veículo" : "Selecione primeiro o cliente"}</option>
                {visibleVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} · {[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ")}
                  </option>
                ))}
              </select>
              <small className="quote-picker-meta">
                {!customerId
                  ? "Escolha o cliente para listar veículos"
                  : filteredVehicles.length === 0
                    ? "Nenhum veículo encontrado"
                    : `Mostrando ${Math.min(visibleVehicles.length, filteredVehicles.length)} de ${filteredVehicles.length}`}
                {customerId && filteredVehicles.length > vehicleLimit ? (
                  <button type="button" className="quote-picker-more" onClick={() => setVehicleLimit((current) => current + PICKER_PAGE_SIZE)}>
                    Mostrar mais
                  </button>
                ) : null}
              </small>
            </label>
            <label>
              <span>Quilometragem *</span>
              <input name="mileage" value={mileage} onChange={(event) => setMileage(event.target.value.replace(/\D/g, ""))} inputMode="numeric" required placeholder="87500" />
            </label>
          </div>
          {selectedVehicle ? (
            <div className="quote-builder-vehicle-preview">
              <span className="orbiq-plate">{selectedVehicle.plate}</span>
              <div>
                <strong>{[selectedVehicle.brand, selectedVehicle.model, selectedVehicle.version].filter(Boolean).join(" ")}</strong>
                <span>{selectedVehicle.model_year ? `Ano ${selectedVehicle.model_year}` : "Ano não informado"}</span>
              </div>
            </div>
          ) : null}
          <div className="quote-priority-group">
            <span>Prioridade</span>
            <div>
              <label>
                <input type="radio" name="priority" value="normal" defaultChecked />
                <strong>Normal</strong>
                <small>Fluxo padrão</small>
              </label>
              <label>
                <input type="radio" name="priority" value="customer_waiting" />
                <strong>Cliente aguardando</strong>
                <small>Cliente permanece na oficina</small>
              </label>
              <label>
                <input type="radio" name="priority" value="vehicle_stopped" />
                <strong>Veículo parado</strong>
                <small>Prioridade operacional</small>
              </label>
            </div>
          </div>
          <div className="quote-step-actions">
            <button
              type="button"
              className="orbiq-primary-button quote-step-continue"
              disabled={!step1Complete}
              onClick={() => continueTo(2)}
            >
              Continuar
            </button>
          </div>
        </div>
      </section>

      <section className={`orbiq-panel quote-step${openStep === 2 ? " is-open" : ""}${!step1Ready ? " is-soft-locked" : ""}`}>
        <button type="button" className="quote-step-toggle" aria-expanded={openStep === 2} onClick={() => toggleStep(2)}>
          <div>
            <span className="orbiq-eyebrow">2 · SERVIÇOS</span>
            <h2>Serviços realizados</h2>
            {!step1Ready ? <p className="quote-builder-section-description">Preencha cliente e veículo no passo 1 (ou busque pelo telefone) para começar com tranquilidade.</p> : null}
          </div>
          <span className="quote-step-chevron" aria-hidden="true">{openStep === 2 ? "−" : "+"}</span>
        </button>
        <div className="quote-step-body" hidden={openStep !== 2}>
          <p className="quote-builder-section-description">Selecione a área e depois o serviço. O valor salvo no catálogo é o valor unitário.</p>
          <div className="quote-labor-browser">
            <div className="quote-labor-search">
              <select
                value={serviceCategory}
                onChange={(event) => {
                  setServiceCategory(event.target.value);
                  setServiceQuery("");
                  setServiceLimit(CATALOG_PAGE_SIZE);
                }}
                aria-label="Área do serviço"
              >
                <option value="">Selecione a área do serviço</option>
                {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <input
                type="search"
                value={serviceQuery}
                onChange={(event) => {
                  setServiceQuery(event.target.value);
                  setServiceLimit(CATALOG_PAGE_SIZE);
                }}
                placeholder="Buscar serviço no catálogo"
                aria-label="Buscar serviço"
                disabled={!serviceCategory}
                autoComplete="off"
              />
              <span>{filteredServices.length} serviço(s)</span>
            </div>
            {serviceCategory ? (
              filteredServices.length === 0 ? (
                <div className="orbiq-empty compact">
                  <strong>Nenhum serviço encontrado.</strong>
                  <span>Ajuste a busca ou adicione um serviço manual abaixo.</span>
                </div>
              ) : (
                <>
                  <div className="quote-labor-catalog">
                    {visibleServices.map((service) => {
                      const added = selectedServices.some((item) => item.key === `catalog-${service.id}`);
                      return (
                        <button key={service.id} type="button" className={`quote-labor-card${added ? " added" : ""}`} disabled={added} onClick={() => addCatalogService(service)}>
                          <span>{service.category}</span>
                          <strong>{service.description}</strong>
                          <b>{Number(service.default_labor_amount) > 0 ? money(Number(service.default_labor_amount)) : "MÃO DE OBRA A DEFINIR"}</b>
                          <small>{service.requires_part ? "PEÇA JÁ MARCADA PARA COMPRA" : added ? "ADICIONADO" : "+ ADICIONAR"}</small>
                        </button>
                      );
                    })}
                  </div>
                  {filteredServices.length > serviceLimit ? (
                    <div className="quote-catalog-more">
                      <button type="button" className="orbiq-secondary-button" onClick={() => setServiceLimit((current) => current + CATALOG_PAGE_SIZE)}>
                        Mostrar mais serviços ({filteredServices.length - serviceLimit} restantes)
                      </button>
                    </div>
                  ) : null}
                </>
              )
            ) : (
              <div className="orbiq-empty compact">
                <strong>Escolha uma área.</strong>
                <span>Os serviços dessa área aparecerão aqui.</span>
              </div>
            )}
          </div>

          <div className="quote-manual-service">
            <div>
              <span className="orbiq-eyebrow">ADICIONAR SERVIÇO</span>
              <strong>Não encontrou na lista?</strong>
            </div>
            <label>
              <span>Área</span>
              <select value={manualCategory} onChange={(event) => setManualCategory(event.target.value)}>
                {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              <span>Descrição do serviço</span>
              <input value={manualDescription} onChange={(event) => setManualDescription(event.target.value)} placeholder="DESCRIÇÃO DO SERVIÇO" />
            </label>
            <label>
              <span>Mão de obra R$ unitária</span>
              <input value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} inputMode="decimal" placeholder="0,00" />
            </label>
            <button type="button" className="orbiq-secondary-button" onClick={addManualService} disabled={saving}>{saving ? "SALVANDO..." : "+ ADICIONAR SERVIÇO"}</button>
          </div>

          {selectedServices.length > 0 ? (
            <div className="quote-selected-services">
              <div className="quote-selected-title">
                <strong>Serviços selecionados</strong>
                <span>{selectedServices.length}</span>
              </div>
              {selectedServices.map((service) => {
                const quantity = parseQuantity(service.quantity);
                const lineTotal = service.laborAmount * quantity;
                const detailsOpen = Boolean(partDetailsOpen[service.key]);
                return (
                  <article key={service.key} className="quote-selected-service">
                    <div className="quote-selected-service-heading">
                      <div>
                        <span className="orbiq-eyebrow">{service.category}</span>
                        <h3>{service.description}</h3>
                      </div>
                      <div className="quote-selected-service-price">
                        <strong>{money(lineTotal)}</strong>
                        <span>{quantity} × {money(service.laborAmount)}</span>
                      </div>
                      <button type="button" className="quote-remove-button" onClick={() => removeService(service.key)} aria-label="Remover serviço">×</button>
                    </div>
                    <div className="quote-selected-service-controls">
                      <label>
                        <span>Qtd. serviço</span>
                        <input value={service.quantity} onChange={(event) => patchService(service.key, { quantity: event.target.value })} inputMode="decimal" />
                      </label>
                      <label>
                        <span>Valor unitário</span>
                        <input
                          value={service.laborAmount.toFixed(2).replace(".", ",")}
                          onChange={(event) => {
                            const parsed = parseMoney(event.target.value);
                            if (parsed !== null) patchService(service.key, { laborAmount: parsed });
                          }}
                          inputMode="decimal"
                        />
                      </label>
                      {service.serviceCatalogId ? (
                        <button type="button" className="orbiq-secondary-button" onClick={() => saveLabor(service)} disabled={saving}>
                          {saving ? "SALVANDO..." : "SALVAR VALOR UNITÁRIO"}
                        </button>
                      ) : null}
                    </div>
                    <label className="quote-needs-part">
                      <input type="checkbox" checked={service.needsPart} onChange={(event) => patchService(service.key, { needsPart: event.target.checked, ...(event.target.checked ? {} : { hasManualPrice: false, partCost: "", partSale: "" }) })} />
                      <span>
                        <strong>Precisa comprar peça</strong>
                        <small>Você pode informar o preço agora (Preço direto) ou cotar fornecedores depois.</small>
                      </span>
                    </label>
                    {service.needsPart ? (
                      <div className="quote-service-part-grid">
                        <label>
                          <span>Peça *</span>
                          <input
                            value={service.partDescription}
                            onChange={(event) => patchService(service.key, { partDescription: event.target.value.toLocaleUpperCase("pt-BR") })}
                            required
                            placeholder="COXIM DO MOTOR"
                          />
                        </label>
                        <label>
                          <span>Categoria</span>
                          <select value={service.partCategory} onChange={(event) => patchService(service.key, { partCategory: event.target.value })}>
                            {itemCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Qtd.</span>
                          <input value={service.partQuantity} onChange={(event) => patchService(service.key, { partQuantity: event.target.value })} inputMode="decimal" />
                        </label>
                        <div className="quote-part-price-path">
                          <label className="quote-manual-price-toggle">
                            <input
                              type="checkbox"
                              checked={service.hasManualPrice}
                              onChange={(event) => patchService(service.key, { hasManualPrice: event.target.checked, ...(event.target.checked ? {} : { partCost: "", partSale: "" }) })}
                            />
                            <span>
                              <strong>Já tenho o preço</strong>
                              <small>Preço direto — sem cotar fornecedor</small>
                            </span>
                          </label>
                          {service.hasManualPrice ? (
                            <div className="quote-manual-price-fields">
                              <label>
                                <span>Custo unit. R$ *</span>
                                <input
                                  value={service.partCost}
                                  onChange={(event) => patchService(service.key, { partCost: event.target.value })}
                                  inputMode="decimal"
                                  required
                                  placeholder="0,00"
                                  aria-label={`Custo unitário de ${service.partDescription || "peça"}`}
                                />
                              </label>
                              <label>
                                <span>Venda unit. R$ (opcional)</span>
                                <input
                                  value={service.partSale}
                                  onChange={(event) => patchService(service.key, { partSale: event.target.value })}
                                  inputMode="decimal"
                                  placeholder="Margem no Comercial"
                                  aria-label={`Preço de venda unitário de ${service.partDescription || "peça"}`}
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="quote-part-pending-price">
                              <span>VALOR DA PEÇA</span>
                              <strong>SERÁ COTADO</strong>
                            </div>
                          )}
                        </div>
                        <div className="quote-part-details">
                          <button type="button" className="quote-part-details-toggle" aria-expanded={detailsOpen} onClick={() => togglePartDetails(service.key)}>
                            {detailsOpen ? "Ocultar detalhes da peça" : "Detalhes da peça"}
                          </button>
                          {detailsOpen ? (
                            <div className="quote-part-details-body">
                              <label>
                                <span>Unidade</span>
                                <select value={service.partUnit} onChange={(event) => patchService(service.key, { partUnit: event.target.value })}>
                                  {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                                </select>
                              </label>
                              <label>
                                <span>Lado</span>
                                <select value={service.partSide} onChange={(event) => patchService(service.key, { partSide: event.target.value })}>
                                  {sides.map((side) => <option key={side || "none"} value={side}>{side || "NÃO SE APLICA"}</option>)}
                                </select>
                              </label>
                              <label>
                                <span>Especificação</span>
                                <input
                                  value={service.partSpecification}
                                  onChange={(event) => patchService(service.key, { partSpecification: event.target.value.toLocaleUpperCase("pt-BR") })}
                                  placeholder="MARCA, MEDIDA..."
                                />
                              </label>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="quote-builder-empty">
              <span>+</span>
              <strong>Nenhum serviço selecionado</strong>
              <small>Escolha uma área acima para começar.</small>
            </div>
          )}
          <div className="quote-step-actions">
            <button type="button" className="orbiq-primary-button quote-step-continue" disabled={selectedServices.length === 0} onClick={() => continueTo(3)}>
              Continuar
            </button>
          </div>
        </div>
      </section>

      <section className={`orbiq-panel quote-step${openStep === 3 ? " is-open" : ""}${!step1Ready ? " is-soft-locked" : ""}`}>
        <button type="button" className="quote-step-toggle" aria-expanded={openStep === 3} onClick={() => toggleStep(3)}>
          <div>
            <span className="orbiq-eyebrow">3 · PEÇAS ADICIONAIS</span>
            <h2>Itens para cotação</h2>
          </div>
          <span className="quote-step-chevron" aria-hidden="true">{openStep === 3 ? "−" : "+"}</span>
        </button>
        <div className="quote-step-body" hidden={openStep !== 3}>
          <p className="quote-builder-section-description">Para itens que não vieram diretamente de um serviço.</p>
          <div className="quote-extra-item-form">
            <label>
              <span>Peça / item</span>
              <input value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} placeholder="PEÇA / ITEM" />
            </label>
            <label>
              <span>Categoria</span>
              <select value={itemCategory} onChange={(event) => setItemCategory(event.target.value)}>
                {itemCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              <span>Qtd.</span>
              <input value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} inputMode="decimal" placeholder="1" />
            </label>
            <div className="quote-part-details quote-extra-details">
              <button type="button" className="quote-part-details-toggle" aria-expanded={extraDetailsOpen} onClick={() => setExtraDetailsOpen((current) => !current)}>
                {extraDetailsOpen ? "Ocultar detalhes da peça" : "Detalhes da peça"}
              </button>
              {extraDetailsOpen ? (
                <div className="quote-part-details-body">
                  <label>
                    <span>Unidade</span>
                    <select value={itemUnit} onChange={(event) => setItemUnit(event.target.value)}>
                      {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Lado</span>
                    <select value={itemSide} onChange={(event) => setItemSide(event.target.value)}>
                      {sides.map((side) => <option key={side || "none"} value={side}>{side || "LADO: NÃO SE APLICA"}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Especificação</span>
                    <input value={itemSpecification} onChange={(event) => setItemSpecification(event.target.value)} placeholder="ESPECIFICAÇÃO" />
                  </label>
                </div>
              ) : null}
            </div>
            <button type="button" onClick={addExtraItem} className="orbiq-secondary-button">+ PEÇA</button>
          </div>
          {itemsPayload.length > 0 ? (
            <div className="quote-parts-summary">
              {generatedItems.map((item, index) => (
                <article key={`automatic-${index}`}>
                  <div>
                    <span className="orbiq-eyebrow">AUTOMÁTICO</span>
                    <strong>{item.description || "PEÇA AINDA NÃO INFORMADA"}</strong>
                    <small>{item.category}{item.chosen_amount !== null ? " · Preço direto" : " · Será cotado"}</small>
                  </div>
                  <span>{item.quantity} {item.unit}</span>
                </article>
              ))}
              {extraItems.map((item) => (
                <article key={item.key} className="quote-extra-item-card">
                  <div>
                    <span className="orbiq-eyebrow">ADICIONAL</span>
                    <strong>{item.description}</strong>
                    <small>{item.category}{item.side ? ` · ${item.side}` : ""}</small>
                  </div>
                  <span>{item.quantity} {item.unit}</span>
                  <button type="button" className="quote-remove-button" onClick={() => removeExtraItem(item.key)}>×</button>
                  <label className="quote-manual-price-toggle">
                    <input
                      type="checkbox"
                      checked={item.hasManualPrice}
                      onChange={(event) => patchExtraItem(item.key, { hasManualPrice: event.target.checked, ...(event.target.checked ? {} : { partCost: "", partSale: "" }) })}
                    />
                    <span>
                      <strong>Já tenho o preço</strong>
                      <small>Preço direto</small>
                    </span>
                  </label>
                  {item.hasManualPrice ? (
                    <div className="quote-manual-price-fields">
                      <label>
                        <span>Custo unit. R$ *</span>
                        <input value={item.partCost} onChange={(event) => patchExtraItem(item.key, { partCost: event.target.value })} inputMode="decimal" required placeholder="0,00" />
                      </label>
                      <label>
                        <span>Venda unit. (opc.)</span>
                        <input value={item.partSale} onChange={(event) => patchExtraItem(item.key, { partSale: event.target.value })} inputMode="decimal" placeholder="Margem no Comercial" />
                      </label>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="quote-builder-empty compact">
              <strong>Nenhuma peça adicionada.</strong>
              <small>Um orçamento pode conter somente serviços.</small>
            </div>
          )}
          <div className="quote-step-actions">
            <button type="button" className="orbiq-primary-button quote-step-continue" onClick={() => continueTo(4)}>
              Continuar
            </button>
          </div>
        </div>
      </section>

      <section className={`orbiq-panel quote-step${openStep === 4 ? " is-open" : ""}${!step1Ready ? " is-soft-locked" : ""}`}>
        <button type="button" className="quote-step-toggle" aria-expanded={openStep === 4} onClick={() => toggleStep(4)}>
          <div>
            <span className="orbiq-eyebrow">4 · OBSERVAÇÕES</span>
            <h2>Informações do atendimento</h2>
          </div>
          <span className="quote-step-chevron" aria-hidden="true">{openStep === 4 ? "−" : "+"}</span>
        </button>
        <div className="quote-step-body" hidden={openStep !== 4}>
          <label>
            <span>Observações gerais</span>
            <textarea name="notes" rows={5} className="quote-builder-notes" placeholder="OBSERVAÇÕES GERAIS DO ORÇAMENTO..." />
          </label>
        </div>
      </section>

      <section className="quote-builder-finish">
        <div>
          <span>Serviços</span>
          <strong>{selectedServices.length}</strong>
        </div>
        <div>
          <span>Itens para compra</span>
          <strong>{itemsPayload.length}</strong>
        </div>
        <div>
          <span>Mão de obra</span>
          <strong>{money(laborTotal)}</strong>
        </div>
        <button type="submit" className="orbiq-primary-button quote-save-button" disabled={!canSave || saving}>
          {saving ? "SALVANDO..." : "SALVAR ORÇAMENTO"}
        </button>
      </section>
    </form>
  );
}
