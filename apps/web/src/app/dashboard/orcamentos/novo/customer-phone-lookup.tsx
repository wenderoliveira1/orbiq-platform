"use client";

import { useMemo, useState } from "react";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
};

type Vehicle = {
  id: string;
  customer_id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  version: string | null;
};

type Props = {
  customers: Customer[];
  vehicles: Vehicle[];
};

function digits(value: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizePlateQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]/g, "");
}

function setSelectValue(name: string, value: string) {
  const select = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!select) return;

  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyIdentity(customerId: string, vehicleId?: string) {
  setSelectValue("customer_id", customerId);
  if (vehicleId) {
    window.setTimeout(() => setSelectValue("vehicle_id", vehicleId), 0);
  }
}

export function CustomerPhoneLookup({ customers, vehicles }: Props) {
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");

  const customerByPhone = useMemo(() => {
    const query = digits(phone);
    if (query.length < 4) return null;
    return customers.find((item) => digits(item.phone) === query) ?? null;
  }, [customers, phone]);

  const vehicleByPlate = useMemo(() => {
    const query = normalizePlateQuery(plate);
    if (query.length < 4) return null;
    const exact = vehicles.find((item) => normalizePlateQuery(item.plate) === query);
    if (exact) return exact;
    const matches = vehicles.filter((item) => normalizePlateQuery(item.plate).includes(query));
    return matches.length === 1 ? matches[0] : null;
  }, [vehicles, plate]);

  const customerByPlate = useMemo(
    () => (vehicleByPlate ? customers.find((item) => item.id === vehicleByPlate.customer_id) ?? null : null),
    [customers, vehicleByPlate],
  );

  const phoneVehicles = useMemo(
    () => (customerByPhone ? vehicles.filter((vehicle) => vehicle.customer_id === customerByPhone.id) : []),
    [customerByPhone, vehicles],
  );

  function handlePhoneChange(value: string) {
    const query = digits(value);
    setPhone(query);

    const found = customers.find((item) => digits(item.phone) === query && query.length >= 4);
    if (!found) return;

    const foundVehicles = vehicles.filter((vehicle) => vehicle.customer_id === found.id);
    applyIdentity(found.id, foundVehicles.length === 1 ? foundVehicles[0].id : undefined);
  }

  function handlePlateChange(value: string) {
    const raw = value.toLocaleUpperCase("pt-BR");
    setPlate(raw);
    const query = normalizePlateQuery(raw);
    if (query.length < 4) return;

    const exact = vehicles.find((item) => normalizePlateQuery(item.plate) === query);
    const partial = vehicles.filter((item) => normalizePlateQuery(item.plate).includes(query));
    const found = exact ?? (partial.length === 1 ? partial[0] : null);
    if (!found) return;

    applyIdentity(found.customer_id, found.id);
  }

  return (
    <section className="orbiq-panel no-print" style={{ marginBottom: 16 }} data-testid="quote-identity-lookup">
      <div className="orbiq-panel-heading">
        <div>
          <span className="orbiq-eyebrow">CLIENTE EXISTENTE</span>
          <h2>Buscar por telefone ou placa</h2>
        </div>
      </div>

      <div className="orbiq-form">
        <label>
          <span>Telefone do cliente</span>
          <input
            value={phone}
            onChange={(event) => handlePhoneChange(event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="DIGITE O TELEFONE CADASTRADO"
            data-testid="quote-phone-lookup"
          />
        </label>

        <label>
          <span>Placa do veículo</span>
          <input
            value={plate}
            onChange={(event) => handlePlateChange(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="DIGITE A PLACA — O CLIENTE APARECE NA HORA"
            data-testid="quote-plate-lookup"
          />
        </label>

        {vehicleByPlate && customerByPlate ? (
          <div className="orbiq-alert success" data-testid="quote-plate-lookup-hit">
            <strong>{customerByPlate.name}</strong>
            {` • ${[vehicleByPlate.brand, vehicleByPlate.model].filter(Boolean).join(" ")} • ${vehicleByPlate.plate}`}
          </div>
        ) : plate && normalizePlateQuery(plate).length >= 4 ? (
          <div className="orbiq-alert error" data-testid="quote-plate-lookup-miss">
            NENHUM VEÍCULO ENCONTRADO COM ESSA PLACA.
          </div>
        ) : null}

        {customerByPhone ? (
          <div className="orbiq-alert success" data-testid="quote-phone-lookup-hit">
            <strong>{customerByPhone.name}</strong>
            {phoneVehicles.length === 1
              ? ` • ${[phoneVehicles[0].brand, phoneVehicles[0].model].filter(Boolean).join(" ")} • ${phoneVehicles[0].plate}`
              : phoneVehicles.length > 1
                ? ` • ${phoneVehicles.length} VEÍCULOS ENCONTRADOS — SELECIONE O VEÍCULO ABAIXO.`
                : " • CLIENTE ENCONTRADO, MAS SEM VEÍCULO CADASTRADO."}
          </div>
        ) : phone ? (
          <div className="orbiq-alert error" data-testid="quote-phone-lookup-miss">
            NENHUM CLIENTE ENCONTRADO COM ESSE TELEFONE.
          </div>
        ) : null}
      </div>
    </section>
  );
}
