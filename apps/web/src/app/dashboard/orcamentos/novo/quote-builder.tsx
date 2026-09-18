"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { FunilariaGuidedPicker } from "../_components/funilaria-guided-picker";
import { QuoteVoiceCapture, type QuoteVoiceConfirmPayload } from "../_components/quote-voice-capture";
import {
  compactVisitServices,
  formatVisitDate,
  formatVisitKm,
  workshopVisitsForVehicle,
  type HistoryVisit,
} from "../../_lib/operational-history";
import {
  createQuickCustomerVehicleAction,
  createQuoteV2Action,
  discardQuoteBuilderServerDraftAction,
  saveServiceCatalogAction,
  saveServiceLaborAction,
  upsertQuoteBuilderDraftAction,
} from "./actions";
import {
  canSyncQuoteBuilderDraftToServer,
  clearQuoteBuilderDraft,
  isMeaningfulQuoteBuilderDraft,
  QUOTE_BUILDER_DRAFT_DEBOUNCE_MS,
  QUOTE_BUILDER_SERVER_SYNC_DEBOUNCE_MS,
  readQuoteBuilderDraft,
  writeQuoteBuilderDraft,
  type QuoteBuilderDraftPriority,
  type QuoteBuilderDraftStep,
} from "./quote-builder-draft";

type Customer = { id: string; name: string; phone: string | null };
type Vehicle = { id: string; customer_id: string; plate: string; brand: string | null; model: string | null; version: string | null; model_year: number | null; mileage: number | null };
type ServiceCatalogItem = { id: string; category: string; description: string; default_labor_amount: number; requires_part: boolean };
type SelectedService = { key: string; serviceCatalogId: string | null; category: string; description: string; laborAmount: number; quantity: string; needsPart: boolean; partDescription: string; partCategory: string; partQuantity: string; partUnit: string; partSide: string; partSpecification: string; hasManualPrice: boolean; partCost: string; partSale: string };
type ExtraItem = { key: string; category: string; description: string; quantity: string; unit: string; side: string; specification: string; hasManualPrice: boolean; partCost: string; partSale: string };
type Props = {
  customers: Customer[];
  vehicles: Vehicle[];
  serviceCatalog: ServiceCatalogItem[];
  organizationId: string;
  userId: string;
  errorMessage?: string;
  initialCustomerId?: string;
  initialVehicleId?: string;
  lastMileageByVehicleId?: Record<string, number>;
  recentVisits?: HistoryVisit[];
};
type StepId = QuoteBuilderDraftStep;
type ServiceAddMode = "funilaria" | "catalogo" | "manual";

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

export function QuoteBuilder({ customers, vehicles, serviceCatalog, organizationId, userId, errorMessage, initialCustomerId = "", initialVehicleId = "", lastMileageByVehicleId = {}, recentVisits = [] }: Props) {
  const [availableCustomers, setAvailableCustomers] = useState(customers);
  const [availableVehicles, setAvailableVehicles] = useState(vehicles);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [mileage, setMileage] = useState(() => {
    if (initialVehicleId && lastMileageByVehicleId[initialVehicleId] != null) {
      return String(lastMileageByVehicleId[initialVehicleId]);
    }
    const vehicle = vehicles.find((item) => item.id === initialVehicleId);
    return vehicle?.mileage != null ? String(vehicle.mileage) : "";
  });
  const [priority, setPriority] = useState<QuoteBuilderDraftPriority>("normal");
  const [notes, setNotes] = useState("");
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
  const [quickRegistering, startQuickRegistering] = useTransition();
  const [openStep, setOpenStep] = useState<StepId>(1);
  const [serviceAddMode, setServiceAddMode] = useState<ServiceAddMode>("funilaria");
  const [partDetailsOpen, setPartDetailsOpen] = useState<Record<string, boolean>>({});
  const [extraDetailsOpen, setExtraDetailsOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [identityQuery, setIdentityQuery] = useState("");
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickPlate, setQuickPlate] = useState("");
  const [quickBrand, setQuickBrand] = useState("");
  const [quickModel, setQuickModel] = useState("");
  const [quickMileage, setQuickMileage] = useState("");
  const [quickRegistrationError, setQuickRegistrationError] = useState<string | null>(null);
  const [builderMessage, setBuilderMessage] = useState<string | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [customerLimit, setCustomerLimit] = useState(PICKER_PAGE_SIZE);
  const [vehicleLimit, setVehicleLimit] = useState(PICKER_PAGE_SIZE);
  const [serviceLimit, setServiceLimit] = useState(CATALOG_PAGE_SIZE);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [missingPriceAcknowledged, setMissingPriceAcknowledged] = useState(false);
  const [showMissingPriceGuard, setShowMissingPriceGuard] = useState(false);
  const [serverDraftQuoteId, setServerDraftQuoteId] = useState<string | null>(null);
  const [serverDraftProtocol, setServerDraftProtocol] = useState<string | null>(null);
  const [serverDraftStatus, setServerDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const skipNextServerSyncRef = useRef(true);
  const serverSyncInFlightRef = useRef(false);

  const selectedCustomer = useMemo(() => availableCustomers.find((customer) => customer.id === customerId), [availableCustomers, customerId]);
  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase("pt-BR");
    const digitsQuery = customerQuery.replace(/\D/g, "");
    if (!query) return availableCustomers;
    return availableCustomers.filter((customer) => {
      const name = customer.name.toLocaleLowerCase("pt-BR");
      const phone = String(customer.phone ?? "");
      const phoneDigits = phone.replace(/\D/g, "");
      return name.includes(query) || phone.toLocaleLowerCase("pt-BR").includes(query) || (digitsQuery.length >= 2 && phoneDigits.includes(digitsQuery));
    });
  }, [availableCustomers, customerQuery]);
  const visibleCustomers = useMemo(() => {
    const list = filteredCustomers.slice(0, customerLimit);
    if (selectedCustomer && !list.some((customer) => customer.id === selectedCustomer.id)) {
      return [selectedCustomer, ...list];
    }
    return list;
  }, [filteredCustomers, customerLimit, selectedCustomer]);

  const filteredVehicles = useMemo(() => {
    const owned = availableVehicles.filter((vehicle) => vehicle.customer_id === customerId);
    const query = vehicleQuery.trim().toLocaleLowerCase("pt-BR");
    if (!query) return owned;
    return owned.filter((vehicle) => {
      const haystack = [vehicle.plate, vehicle.brand, vehicle.model, vehicle.version]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return haystack.includes(query);
    });
  }, [availableVehicles, customerId, vehicleQuery]);
  const selectedVehicle = useMemo(() => availableVehicles.find((vehicle) => vehicle.id === vehicleId), [availableVehicles, vehicleId]);
  const selectedVehicleVisits = useMemo(
    () => workshopVisitsForVehicle(recentVisits, vehicleId, 6),
    [recentVisits, vehicleId],
  );
  const visibleVehicles = useMemo(() => {
    const list = filteredVehicles.slice(0, vehicleLimit);
    if (selectedVehicle && selectedVehicle.customer_id === customerId && !list.some((vehicle) => vehicle.id === selectedVehicle.id)) {
      return [selectedVehicle, ...list];
    }
    return list;
  }, [filteredVehicles, vehicleLimit, selectedVehicle, customerId]);

  const identityResults = useMemo(() => {
    const raw = identityQuery.trim();
    if (raw.length < 2) return [];
    const query = normalizeCategory(raw);
    const digits = raw.replace(/\D/g, "");
    const vehicleMatches = availableVehicles
      .filter((vehicle) => normalizeCategory([vehicle.plate, vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ")).includes(query))
      .slice(0, 6)
      .map((vehicle) => ({
        kind: "vehicle" as const,
        customer: availableCustomers.find((customer) => customer.id === vehicle.customer_id) ?? null,
        vehicle,
      }));
    const customerMatches = availableCustomers
      .filter((customer) => {
        const phone = String(customer.phone ?? "");
        return normalizeCategory(customer.name).includes(query) ||
          normalizeCategory(phone).includes(query) ||
          (digits.length >= 2 && phone.replace(/\D/g, "").includes(digits));
      })
      .slice(0, 6)
      .map((customer) => ({ kind: "customer" as const, customer, vehicle: null }));
    return [...vehicleMatches, ...customerMatches].slice(0, 8);
  }, [availableCustomers, availableVehicles, identityQuery]);

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

  useEffect(() => {
    let cancelled = false;
    // Defer restore so we do not setState synchronously inside the effect body
    // (react-hooks/set-state-in-effect). localStorage is only available in the browser.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const draft = readQuoteBuilderDraft(organizationId, userId);
      const hasUrlIdentity = Boolean(initialCustomerId);
      if (draft && isMeaningfulQuoteBuilderDraft(draft)) {
        if (hasUrlIdentity) {
          setCustomerId(initialCustomerId);
          setVehicleId(initialVehicleId);
          const lastKm = initialVehicleId ? lastMileageByVehicleId[initialVehicleId] : undefined;
          const vehicle = vehicles.find((item) => item.id === initialVehicleId);
          setMileage(lastKm != null ? String(lastKm) : vehicle?.mileage != null ? String(vehicle.mileage) : "");
          if (draft.customerId === initialCustomerId && (!initialVehicleId || draft.vehicleId === initialVehicleId)) {
            setPriority(draft.priority);
            setNotes(draft.notes);
            setServiceCategory(draft.serviceCategory);
            setSelectedServices(draft.selectedServices);
            setExtraItems(draft.extraItems);
            setOpenStep(draft.openStep);
            setServerDraftQuoteId(draft.serverDraftQuoteId);
            setServerDraftProtocol(draft.serverDraftProtocol);
            setDraftRestored(true);
          }
        } else {
          const customerExists = !draft.customerId || customers.some((customer) => customer.id === draft.customerId);
          const vehicleExists =
            !draft.vehicleId ||
            vehicles.some(
              (vehicle) =>
                vehicle.id === draft.vehicleId &&
                (!draft.customerId || vehicle.customer_id === draft.customerId),
            );
          setCustomerId(customerExists ? draft.customerId : "");
          setVehicleId(customerExists && vehicleExists ? draft.vehicleId : "");
          setMileage(draft.mileage);
          setPriority(draft.priority);
          setNotes(draft.notes);
          setServiceCategory(draft.serviceCategory);
          setSelectedServices(draft.selectedServices);
          setExtraItems(draft.extraItems);
          setOpenStep(draft.openStep);
          setServerDraftQuoteId(draft.serverDraftQuoteId);
          setServerDraftProtocol(draft.serverDraftProtocol);
          setDraftRestored(true);
        }
      } else if (hasUrlIdentity) {

        const lastKm = initialVehicleId ? lastMileageByVehicleId[initialVehicleId] : undefined;
        const vehicle = vehicles.find((item) => item.id === initialVehicleId);
        setMileage(lastKm != null ? String(lastKm) : vehicle?.mileage != null ? String(vehicle.mileage) : "");
      }
      setDraftReady(true);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Restore only on mount for this org/user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMissingPriceAcknowledged(false);
      setShowMissingPriceGuard(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedServices, extraItems]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      writeQuoteBuilderDraft({
        version: 1,
        updatedAt: new Date().toISOString(),
        organizationId,
        userId,
        openStep,
        customerId,
        vehicleId,
        mileage,
        priority,
        notes,
        serviceCategory,
        selectedServices,
        extraItems,
        serverDraftQuoteId,
        serverDraftProtocol,
      });
    }, QUOTE_BUILDER_DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    draftReady,
    organizationId,
    userId,
    openStep,
    customerId,
    vehicleId,
    mileage,
    priority,
    notes,
    serviceCategory,
    selectedServices,
    extraItems,
    serverDraftQuoteId,
    serverDraftProtocol,
  ]);

  useEffect(() => {
    if (!draftReady) return;
    if (skipNextServerSyncRef.current) {
      skipNextServerSyncRef.current = false;
      return;
    }
    if (!canSyncQuoteBuilderDraftToServer({ customerId, vehicleId, mileage, selectedServices })) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (serverSyncInFlightRef.current) return;
      serverSyncInFlightRef.current = true;
      setServerDraftStatus("saving");
      const syncItems = itemsPayload.filter((item) => item.description.trim().length >= 2);
      void upsertQuoteBuilderDraftAction({
        draftQuoteId: serverDraftQuoteId,
        customerId,
        vehicleId,
        priority,
        mileage,
        notes,
        servicesJson: JSON.stringify(servicesPayload),
        itemsJson: JSON.stringify(syncItems),
      })
        .then((result) => {
          if (!result.ok) {
            setServerDraftStatus("error");
            return;
          }
          setServerDraftQuoteId(result.quoteId);
          setServerDraftProtocol(result.protocol || null);
          setServerDraftStatus("saved");
        })
        .catch(() => setServerDraftStatus("error"))
        .finally(() => {
          serverSyncInFlightRef.current = false;
        });
    }, QUOTE_BUILDER_SERVER_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    draftReady,
    customerId,
    vehicleId,
    mileage,
    priority,
    notes,
    selectedServices,
    servicesPayload,
    itemsPayload,
    serverDraftQuoteId,
  ]);

  function resetBuilderState() {
    setCustomerId("");
    setVehicleId("");
    setMileage("");
    setPriority("normal");
    setNotes("");
    setServiceCategory("");
    setSelectedServices([]);
    setExtraItems([]);
    setOpenStep(1);
    setCustomerQuery("");
    setVehicleQuery("");
    setServiceQuery("");
    setCustomerLimit(PICKER_PAGE_SIZE);
    setVehicleLimit(PICKER_PAGE_SIZE);
    setServiceLimit(CATALOG_PAGE_SIZE);
    setServerDraftQuoteId(null);
    setServerDraftProtocol(null);
    setServerDraftStatus("idle");
    setDraftRestored(false);
  }

  function discardDraft() {
    const quoteId = serverDraftQuoteId;
    clearQuoteBuilderDraft(organizationId, userId);
    resetBuilderState();
    skipNextServerSyncRef.current = true;
    if (quoteId) {
      void discardQuoteBuilderServerDraftAction(quoteId);
    }
  }

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
    const last = lastMileageByVehicleId[id];
    const vehicle = availableVehicles.find((item) => item.id === id);
    setMileage(last != null ? String(last) : vehicle?.mileage != null ? String(vehicle.mileage) : "");
  }
  function selectIdentity(customer: Customer, vehicle?: Vehicle | null) {
    setCustomerId(customer.id);
    setCustomerQuery("");
    setVehicleQuery("");
    if (vehicle) {
      setVehicleId(vehicle.id);
      const last = lastMileageByVehicleId[vehicle.id];
      setMileage(last != null ? String(last) : vehicle.mileage != null ? String(vehicle.mileage) : "");
    } else {
      setVehicleId("");
      setMileage("");
    }
    setIdentityQuery("");
    setQuickRegisterOpen(false);
  }
  function registerCustomerVehicle() {
    setQuickRegistrationError(null);
    startQuickRegistering(async () => {
      const result = await createQuickCustomerVehicleAction({
        customerId: customerId || undefined,
        customerName: quickCustomerName,
        customerPhone: quickCustomerPhone,
        plate: quickPlate,
        brand: quickBrand,
        model: quickModel,
        mileage: quickMileage,
      });
      if (!result.ok) {
        setQuickRegistrationError(result.error);
        return;
      }
      setAvailableCustomers((current) => current.some((item) => item.id === result.customer.id)
        ? current
        : [...current, result.customer].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")));
      setAvailableVehicles((current) => [...current, result.vehicle].sort((left, right) => left.plate.localeCompare(right.plate, "pt-BR")));
      selectIdentity(result.customer, result.vehicle);
      setQuickCustomerName("");
      setQuickCustomerPhone("");
      setQuickPlate("");
      setQuickBrand("");
      setQuickModel("");
      setQuickMileage("");
      setBuilderMessage("Cliente e veículo cadastrados e selecionados.");
    });
  }
  function addCatalogService(service: ServiceCatalogItem) {
    const serviceKey = `catalog-${service.id}`;
    if (selectedServices.some((item) => item.key === serviceKey)) return;
    setSelectedServices((current) => [...current, { key: serviceKey, serviceCatalogId: service.id, category: service.category.toLocaleUpperCase("pt-BR"), description: service.description.toLocaleUpperCase("pt-BR"), laborAmount: Number(service.default_labor_amount) || 0, quantity: "1", needsPart: Boolean(service.requires_part), partDescription: service.description.toLocaleUpperCase("pt-BR"), partCategory: "MECÂNICA", partQuantity: "1", partUnit: "UN", partSide: "", partSpecification: "", hasManualPrice: false, partCost: "", partSale: "" }]);
  }
  function addManualService() {
    const description = manualDescription.trim().toLocaleUpperCase("pt-BR");
    if (description.length < 2) return setBuilderMessage("Informe a descrição do serviço.");
    const amount = parseMoney(manualAmount);
    if (amount === null || amount < 0) return setBuilderMessage("Informe um valor de mão de obra válido.");
    setBuilderMessage(null);
    const localKey = key("manual");
    setSelectedServices((current) => [
      ...current,
      {
        key: localKey,
        serviceCatalogId: null,
        category: manualCategory,
        description,
        laborAmount: amount,
        quantity: "1",
        needsPart: false,
        partDescription: "",
        partCategory: "MECÂNICA",
        partQuantity: "1",
        partUnit: "UN",
        partSide: "",
        partSpecification: "",
        hasManualPrice: false,
        partCost: "",
        partSale: "",
      },
    ]);
    setServiceCategory(manualCategory);
    setManualDescription("");
    setManualAmount("");
    startSaving(async () => {
      const id = await saveServiceCatalogAction(manualCategory, description, amount);
      if (id) patchService(localKey, { serviceCatalogId: id });
    });
  }
  function addVoiceOrGuidedService(input: {
    category: string;
    description: string;
    laborAmount: string;
    needsPart: boolean;
    partDescription: string;
  }) {
    const description = input.description.trim().toLocaleUpperCase("pt-BR");
    if (description.length < 2) return setBuilderMessage("Informe a descrição do serviço.");
    const amountRaw = input.laborAmount.trim();
    const amount = amountRaw ? parseMoney(amountRaw) : 0;
    if (amount === null || amount < 0) return setBuilderMessage("Informe um valor de mão de obra válido.");
    setBuilderMessage(null);
    const category = input.category.toLocaleUpperCase("pt-BR") || "OUTROS";
    const needsPart = Boolean(input.needsPart);
    const partDescription = needsPart
      ? (input.partDescription.trim().toLocaleUpperCase("pt-BR") || description)
      : "";
    const localKey = key("voice");
    setSelectedServices((current) => [
      ...current,
      {
        key: localKey,
        serviceCatalogId: null,
        category,
        description,
        laborAmount: amount,
        quantity: "1",
        needsPart,
        partDescription,
        partCategory: category === "FUNILARIA" ? "FUNILARIA" : "MECÂNICA",
        partQuantity: "1",
        partUnit: "UN",
        partSide: "",
        partSpecification: "",
        hasManualPrice: false,
        partCost: "",
        partSale: "",
      },
    ]);
    setServiceCategory(category);
    setManualCategory(category);
    setManualDescription("");
    setManualAmount("");
    startSaving(async () => {
      const id = await saveServiceCatalogAction(category, description, amount);
      if (id) patchService(localKey, { serviceCatalogId: id });
    });
  }
  function onVoiceConfirm(payload: QuoteVoiceConfirmPayload) {
    addVoiceOrGuidedService({
      category: payload.category,
      description: payload.description,
      laborAmount: payload.laborAmount,
      needsPart: payload.needsPart,
      partDescription: payload.partDescription,
    });
  }
  function saveLabor(service: SelectedService) {
    if (!service.serviceCatalogId) return;
    startSaving(async () => {
      try {
        await saveServiceLaborAction(service.serviceCatalogId!, service.laborAmount);
        setBuilderMessage("Valor de mão de obra atualizado no catálogo.");
      } catch {
        setBuilderMessage("Não foi possível salvar a mão de obra.");
      }
    });
  }
  function patchService(serviceKey: string, patch: Partial<SelectedService>) { setSelectedServices((current) => current.map((service) => service.key === serviceKey ? { ...service, ...patch } : service)); }
  function removeService(serviceKey: string) { setSelectedServices((current) => current.filter((service) => service.key !== serviceKey)); }
  function addExtraItem() {
    const description = itemDescription.trim().toLocaleUpperCase("pt-BR");
    if (description.length < 2) return setBuilderMessage("Informe o nome da peça.");
    setBuilderMessage(null);
    setExtraItems((current) => [...current, { key: key("item"), category: itemCategory, description, quantity: itemQuantity || "1", unit: itemUnit || "UN", side: itemSide, specification: itemSpecification.trim().toLocaleUpperCase("pt-BR"), hasManualPrice: false, partCost: "", partSale: "" }]);
    setItemDescription(""); setItemQuantity("1"); setItemSide(""); setItemSpecification("");
  }
  function removeExtraItem(itemKey: string) { setExtraItems((current) => current.filter((item) => item.key !== itemKey)); }
  function patchExtraItem(itemKey: string, patch: Partial<ExtraItem>) { setExtraItems((current) => current.map((item) => item.key === itemKey ? { ...item, ...patch } : item)); }

  function repeatVisitServices(visit: HistoryVisit) {
    const additions = visit.services.map((description, index) => {
      const catalog = serviceCatalog.find((service) => normalizeCategory(service.description) === normalizeCategory(description));
      return {
        key: catalog ? `catalog-${catalog.id}` : key(`history-${index}`),
        serviceCatalogId: catalog?.id ?? null,
        category: (catalog?.category ?? "OUTROS").toLocaleUpperCase("pt-BR"),
        description: description.toLocaleUpperCase("pt-BR"),
        laborAmount: Number(catalog?.default_labor_amount ?? 0),
        quantity: "1",
        needsPart: Boolean(catalog?.requires_part),
        partDescription: catalog?.requires_part ? description.toLocaleUpperCase("pt-BR") : "",
        partCategory: normalizeCategory(catalog?.category ?? "") === "FUNILARIA" ? "FUNILARIA" : "MECÂNICA",
        partQuantity: "1",
        partUnit: "UN",
        partSide: "",
        partSpecification: "",
        hasManualPrice: false,
        partCost: "",
        partSale: "",
      } satisfies SelectedService;
    });
    setSelectedServices((current) => {
      const descriptions = new Set(current.map((service) => normalizeCategory(service.description)));
      return [...current, ...additions.filter((service) => !descriptions.has(normalizeCategory(service.description)))];
    });
    setBuilderMessage(`${additions.length} serviço(s) do histórico foram reaproveitados.`);
  }

  function togglePartDetails(serviceKey: string) {
    setPartDetailsOpen((current) => ({ ...current, [serviceKey]: !current[serviceKey] }));
  }

  const generatedPartMissing = selectedServices.some((service) => service.needsPart && service.partDescription.trim().length < 2);
  const invalidManualCost = selectedServices.some((service) => {
      if (!service.needsPart || !service.hasManualPrice) return false;
      const raw = service.partCost.trim();
      if (!raw) return false;
      const parsed = parseMoney(raw);
      return parsed === null || parsed < 0;
    })
    || extraItems.some((item) => {
      if (!item.hasManualPrice) return false;
      const raw = item.partCost.trim();
      if (!raw) return false;
      const parsed = parseMoney(raw);
      return parsed === null || parsed < 0;
    });
  const partsWithoutPrice = [
    ...selectedServices
      .filter((service) => service.needsPart && (!service.hasManualPrice || !service.partCost.trim()))
      .map((service) => service.partDescription.trim() || service.description),
    ...extraItems
      .filter((item) => !item.hasManualPrice || !item.partCost.trim())
      .map((item) => item.description),
  ];
  const canSave = Boolean(customerId && vehicleId && mileage.trim() && selectedServices.length > 0 && !generatedPartMissing && !invalidManualCost);

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (partsWithoutPrice.length > 0 && !missingPriceAcknowledged) {
      event.preventDefault();
      setShowMissingPriceGuard(true);
      return;
    }
    clearQuoteBuilderDraft(organizationId, userId);
  }

  return (
    <form action={createQuoteV2Action} className="quote-builder" onSubmit={handleFormSubmit}>
      <input type="hidden" name="services_json" value={JSON.stringify(servicesPayload)} />
      <input type="hidden" name="items_json" value={JSON.stringify(itemsPayload)} />
      <input type="hidden" name="draft_quote_id" value={serverDraftQuoteId ?? ""} />
      {errorMessage ? <div className="orbiq-alert error">{errorMessage}</div> : null}
      {builderMessage ? (
        <div className="orbiq-alert success quote-builder-message" role="status">
          <span>{builderMessage}</span>
          <button type="button" aria-label="Fechar mensagem" onClick={() => setBuilderMessage(null)}>×</button>
        </div>
      ) : null}
      {draftRestored ? (
        <div className="orbiq-alert success quote-draft-banner" role="status" data-testid="quote-draft-restored">
          <div>
            <strong>Rascunho restaurado</strong>
            <span>Seu progresso do Novo Orçamento foi recuperado após sair ou atualizar a página.</span>
            {serverDraftProtocol ? <small>Servidor: {serverDraftProtocol}</small> : null}
          </div>
          <button type="button" className="orbiq-secondary-button" onClick={discardDraft} data-testid="quote-draft-discard">
            Descartar rascunho
          </button>
        </div>
      ) : null}

      <section className="quote-builder-header">
        <div>
          <span className="orbiq-eyebrow">NOVO ORÇAMENTO</span>
          <h1>Orçamento expresso</h1>
          <p>Localize pela placa, telefone ou nome e monte o orçamento sem sair desta tela.</p>
        </div>
        <div className="quote-builder-total">
          <span>Mão de obra</span>
          <strong>{money(laborTotal)}</strong>
          <small>{selectedServices.length} serviço(s)</small>
          {serverDraftStatus === "saving" ? <small className="quote-draft-sync">Salvando rascunho…</small> : null}
          {serverDraftStatus === "saved" && serverDraftProtocol ? (
            <small className="quote-draft-sync">Rascunho no servidor · {serverDraftProtocol}</small>
          ) : null}
          {serverDraftStatus === "error" ? <small className="quote-draft-sync is-error">Falha ao salvar no servidor</small> : null}
        </div>
      </section>

      <section className="orbiq-panel quote-step is-open">
        <div className="quote-step-toggle quote-step-heading">
          <div>
            <span className="orbiq-eyebrow">1 · ATENDIMENTO</span>
            <h2>Cliente e veículo</h2>
            {step1Complete ? (
              <p className="quote-step-summary">
                {selectedCustomer?.name}
                {" · "}
                {selectedVehicle?.plate ?? "Veículo"}
                {mileage.trim() ? ` · ${mileage} km` : ""}
              </p>
            ) : (
              <p className="quote-step-summary">Placa, cliente e km para começar.</p>
            )}
          </div>
        </div>
        <div className="quote-step-body">
          <div className="quote-identity-search">
            <label>
              <span>Busca rápida</span>
              <input
                type="search"
                value={identityQuery}
                onChange={(event) => setIdentityQuery(event.target.value)}
                placeholder="Digite placa, telefone ou nome"
                autoComplete="off"
                aria-label="Buscar por placa, telefone ou nome"
              />
            </label>
            <button type="button" className="orbiq-secondary-button" onClick={() => setQuickRegisterOpen((current) => !current)}>
              {quickRegisterOpen ? "Fechar cadastro" : "+ Cadastro rápido"}
            </button>
            {identityQuery.trim().length >= 2 ? (
              <div className="quote-identity-results" role="listbox" aria-label="Resultados da busca rápida">
                {identityResults.length > 0 ? identityResults.map((result) => (
                  <button
                    key={`${result.kind}-${result.vehicle?.id ?? result.customer?.id}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => result.customer && selectIdentity(result.customer, result.vehicle)}
                  >
                    <span>{result.kind === "vehicle" ? result.vehicle?.plate : "CLIENTE"}</span>
                    <strong>{result.customer?.name ?? "Cliente não encontrado"}</strong>
                    <small>
                      {result.vehicle
                        ? [result.vehicle.brand, result.vehicle.model].filter(Boolean).join(" ")
                        : result.customer?.phone || "Sem telefone"}
                    </small>
                  </button>
                )) : (
                  <div className="quote-identity-empty">
                    <strong>Nenhum cadastro encontrado.</strong>
                    <button type="button" onClick={() => setQuickRegisterOpen(true)}>Cadastrar agora</button>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {quickRegisterOpen ? (
            <div className="quote-quick-register" aria-label="Cadastro rápido de cliente e veículo">
              <div className="quote-quick-register-heading">
                <div>
                  <span className="orbiq-eyebrow">CADASTRO RÁPIDO</span>
                  <strong>{selectedCustomer ? `Novo veículo para ${selectedCustomer.name}` : "Novo cliente e veículo"}</strong>
                </div>
                {selectedCustomer ? (
                  <button type="button" onClick={() => chooseCustomer("")}>Cadastrar outro cliente</button>
                ) : null}
              </div>
              <div className="quote-quick-register-grid">
                {!selectedCustomer ? (
                  <>
                    <label><span>Nome do cliente *</span><input value={quickCustomerName} onChange={(event) => setQuickCustomerName(event.target.value)} autoComplete="name" /></label>
                    <label><span>Telefone</span><input value={quickCustomerPhone} onChange={(event) => setQuickCustomerPhone(event.target.value)} inputMode="tel" autoComplete="tel" /></label>
                  </>
                ) : null}
                <label><span>Placa *</span><input value={quickPlate} onChange={(event) => setQuickPlate(event.target.value.toLocaleUpperCase("pt-BR"))} maxLength={8} autoCapitalize="characters" /></label>
                <label><span>Marca</span><input value={quickBrand} onChange={(event) => setQuickBrand(event.target.value)} /></label>
                <label><span>Modelo *</span><input value={quickModel} onChange={(event) => setQuickModel(event.target.value)} /></label>
                <label><span>Quilometragem</span><input value={quickMileage} onChange={(event) => setQuickMileage(event.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
              </div>
              {quickRegistrationError ? <div className="orbiq-alert error" role="alert">{quickRegistrationError}</div> : null}
              <button type="button" className="orbiq-primary-button" disabled={quickRegistering} onClick={registerCustomerVehicle}>
                {quickRegistering ? "CADASTRANDO..." : "CADASTRAR E USAR NO ORÇAMENTO"}
              </button>
            </div>
          ) : null}

          <div className="quote-builder-grid">
            <label className="quote-picker-field">
              <span>Cliente *</span>
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
              <Link
                href={`/dashboard/veiculos/${selectedVehicle.id}`}
                className="orbiq-secondary-button"
                data-testid="quote-builder-vehicle-history"
              >
                Histórico
              </Link>
            </div>
          ) : null}
          {selectedVehicle && selectedVehicleVisits.length > 0 ? (
            <div className="quote-builder-history" data-testid="quote-builder-visit-history">
              <span className="orbiq-eyebrow">HISTÓRICO DESTE VEÍCULO</span>
              {selectedVehicleVisits.map((visit) => (
                <article key={visit.id}>
                  <p>
                    <strong>{formatVisitDate(visit.createdAt)}</strong>
                    {" · "}
                    {formatVisitKm(visit.mileage)}
                    {" · "}
                    {compactVisitServices(visit.services, 2)}
                  </p>
                  <button type="button" onClick={() => repeatVisitServices(visit)} disabled={visit.services.length === 0}>
                    Repetir serviços
                  </button>
                </article>
              ))}
            </div>
          ) : null}
          <div className="quote-priority-group">
            <span>Prioridade</span>
            <div>
              <label>
                <input type="radio" name="priority" value="normal" checked={priority === "normal"} onChange={() => setPriority("normal")} />
                <strong>Normal</strong>
                <small>Fluxo padrão</small>
              </label>
              <label>
                <input type="radio" name="priority" value="customer_waiting" checked={priority === "customer_waiting"} onChange={() => setPriority("customer_waiting")} />
                <strong>Cliente aguardando</strong>
                <small>Cliente permanece na oficina</small>
              </label>
              <label>
                <input type="radio" name="priority" value="vehicle_stopped" checked={priority === "vehicle_stopped"} onChange={() => setPriority("vehicle_stopped")} />
                <strong>Veículo parado</strong>
                <small>Prioridade operacional</small>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="orbiq-panel quote-step is-open">
        <div className="quote-step-toggle quote-step-heading">
          <div>
            <span className="orbiq-eyebrow">2 · SERVIÇOS</span>
            <h2>Serviços realizados</h2>
            {selectedServices.length > 0 ? (
              <p className="quote-step-summary">
                {selectedServices.length} serviço{selectedServices.length === 1 ? "" : "s"} · {money(laborTotal)}
              </p>
            ) : (
              <p className="quote-step-summary">Funilaria, catálogo ou voz.</p>
            )}
          </div>
        </div>
        <div className="quote-step-body">
          <div className="quote-service-work" data-testid="quote-service-work">
            <div className="quote-service-modes" role="tablist" aria-label="Como adicionar o serviço">
              {(
                [
                  ["funilaria", "Funilaria"],
                  ["catalogo", "Catálogo"],
                  ["manual", "Digitar"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={serviceAddMode === mode}
                  className={serviceAddMode === mode ? "is-active" : ""}
                  data-testid={`quote-service-mode-${mode}`}
                  onClick={() => setServiceAddMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="quote-ops-shortcuts"
              data-testid="quote-ops-shortcuts"
              aria-label="Atalhos de operação: voz e Funilaria"
            >
              <QuoteVoiceCapture
                dense
                className="quote-ops-voice"
                categories={availableCategories}
                onConfirm={onVoiceConfirm}
              />
              {serviceAddMode === "funilaria" ? (
                <FunilariaGuidedPicker
                  className="quote-ops-funilaria is-ops-primary"
                  onConfirm={(payload) =>
                    addVoiceOrGuidedService({
                      category: payload.category,
                      description: payload.description,
                      laborAmount: payload.laborAmount,
                      needsPart: payload.needsPartHint,
                      partDescription: payload.partDescription,
                    })
                  }
                />
              ) : null}
            </div>

            {serviceAddMode === "catalogo" ? (
              <div className="quote-labor-browser">
                <p className="quote-builder-section-description">Área e depois o serviço. O valor do catálogo é unitário.</p>
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
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
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
                      <span>Ajuste a busca ou use Digitar.</span>
                    </div>
                  ) : (
                    <>
                      <div className="quote-labor-catalog">
                        {visibleServices.map((service) => {
                          const added = selectedServices.some((item) => item.key === `catalog-${service.id}`);
                          return (
                            <button
                              key={service.id}
                              type="button"
                              className={`quote-labor-card${added ? " added" : ""}`}
                              disabled={added}
                              onClick={() => addCatalogService(service)}
                            >
                              <span>{service.category}</span>
                              <strong>{service.description}</strong>
                              <b>
                                {Number(service.default_labor_amount) > 0
                                  ? money(Number(service.default_labor_amount))
                                  : "MÃO DE OBRA A DEFINIR"}
                              </b>
                              <small>
                                {service.requires_part
                                  ? "PEÇA JÁ MARCADA PARA COMPRA"
                                  : added
                                    ? "ADICIONADO"
                                    : "+ ADICIONAR"}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                      {filteredServices.length > serviceLimit ? (
                        <div className="quote-catalog-more">
                          <button
                            type="button"
                            className="orbiq-secondary-button"
                            onClick={() => setServiceLimit((current) => current + CATALOG_PAGE_SIZE)}
                          >
                            Mostrar mais serviços ({filteredServices.length - serviceLimit} restantes)
                          </button>
                        </div>
                      ) : null}
                    </>
                  )
                ) : (
                  <div className="orbiq-empty compact">
                    <strong>Escolha uma área.</strong>
                    <span>Os serviços dessa área aparecem aqui.</span>
                  </div>
                )}
              </div>
            ) : null}

            {serviceAddMode === "manual" ? (
              <div className="quote-manual-service">
                <div>
                  <span className="orbiq-eyebrow">ADICIONAR SERVIÇO</span>
                  <strong>Não encontrou na lista?</strong>
                </div>
                <label>
                  <span>Área</span>
                  <select value={manualCategory} onChange={(event) => setManualCategory(event.target.value)}>
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Descrição do serviço</span>
                  <input
                    value={manualDescription}
                    onChange={(event) => setManualDescription(event.target.value)}
                    placeholder="DESCRIÇÃO DO SERVIÇO"
                  />
                </label>
                <label>
                  <span>Mão de obra R$ unitária</span>
                  <input
                    value={manualAmount}
                    onChange={(event) => setManualAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </label>
                <button type="button" className="orbiq-secondary-button" onClick={addManualService} disabled={saving}>
                  {saving ? "SALVANDO..." : "+ ADICIONAR SERVIÇO"}
                </button>
              </div>
            ) : null}

            {selectedServices.length > 0 ? (
              <div className="quote-selected-services">
                <div className="quote-selected-title">
                  <strong>Serviços deste orçamento</strong>
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
              <strong>Nenhum serviço neste orçamento</strong>
              <small>Use Funilaria, catálogo ou voz. Não achou? Digitar.</small>
            </div>
          )}
          </div>
        </div>
      </section>

      <section className="orbiq-panel quote-step is-open">
        <div className="quote-step-toggle quote-step-heading">
          <div>
            <span className="orbiq-eyebrow">3 · PEÇAS ADICIONAIS</span>
            <h2>Itens para cotação</h2>
            <p className="quote-step-summary">
              {itemsPayload.length > 0
                ? `${itemsPayload.length} item(ns) · opcional`
                : "Opcional. Peça extra que não veio do serviço."}
            </p>
          </div>
        </div>
        <div className="quote-step-body">
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
        </div>
      </section>

      <section className="orbiq-panel quote-step is-open">
        <div className="quote-step-toggle quote-step-heading">
          <div>
            <span className="orbiq-eyebrow">4 · OBSERVAÇÕES</span>
            <h2>Informações do atendimento</h2>
            <p className="quote-step-summary">
              {notes.trim() ? "Observação preenchida." : "Opcional."}
            </p>
          </div>
        </div>
        <div className="quote-step-body">
          <label>
            <span>Observações gerais</span>
            <textarea
              name="notes"
              rows={5}
              className="quote-builder-notes"
              placeholder="OBSERVAÇÕES GERAIS DO ORÇAMENTO..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>
      </section>

      {(showMissingPriceGuard || partsWithoutPrice.length > 0) && partsWithoutPrice.length > 0 ? (
          <div
            className={`quote-missing-price-guard${showMissingPriceGuard ? " is-visible" : ""}`}
            role="status"
            data-testid="quote-missing-price-guard"
          >
            <strong>Peças sem custo/preço</strong>
            <span>
              {partsWithoutPrice.length === 1
                ? "1 peça ficará sem preço e poderá ser cotada depois."
                : `${partsWithoutPrice.length} peças ficarão sem preço e poderão ser cotadas depois.`}
              {" "}Confirme para evitar salvar sem perceber.
            </span>
            <ul>
              {partsWithoutPrice.slice(0, 6).map((label, index) => (
                <li key={`${index}-${label}`}>{label}</li>
              ))}
              {partsWithoutPrice.length > 6 ? <li>… e mais {partsWithoutPrice.length - 6}</li> : null}
            </ul>
            <label className="quote-missing-price-ack">
              <input
                type="checkbox"
                checked={missingPriceAcknowledged}
                onChange={(event) => {
                  setMissingPriceAcknowledged(event.target.checked);
                  if (event.target.checked) setShowMissingPriceGuard(true);
                }}
                data-testid="quote-missing-price-ack"
              />
              <span>Entendi — posso salvar sem preço nestas peças</span>
            </label>
          </div>
      ) : null}
      {invalidManualCost ? (
        <div className="orbiq-alert error" role="alert">
          Informe um custo válido nas peças marcadas com &quot;Já tenho o preço&quot;, ou desmarque essa opção.
        </div>
      ) : null}

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
        <button
          type="submit"
          className="orbiq-primary-button quote-save-button"
          disabled={!canSave || saving}
          data-testid="quote-save-button"
        >
          {saving
            ? "SALVANDO..."
            : partsWithoutPrice.length > 0 && !missingPriceAcknowledged
              ? "CONFIRMAR E SALVAR"
              : "SALVAR ORÇAMENTO"}
        </button>
      </section>
    </form>
  );
}
