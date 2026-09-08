"use client";

import { useMemo, useState } from "react";

type Customer = {
  id: string;
  customer_number: number;
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

function setSelectValue(name: string, value: string) {
  const select = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!select) return;

  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export function CustomerPhoneLookup({ customers, vehicles }: Props) {
  const [phone, setPhone] = useState("");

  const customer = useMemo(() => {
    const query = digits(phone);
    if (query.length < 4) return null;
    return customers.find((item) => digits(item.phone) === query) ?? null;
  }, [customers, phone]);

  const customerVehicles = useMemo(
    () => (customer ? vehicles.filter((vehicle) => vehicle.customer_id === customer.id) : []),
    [customer, vehicles],
  );

  function handlePhoneChange(value: string) {
    const query = digits(value);
    setPhone(query);

    const found = customers.find((item) => digits(item.phone) === query && query.length >= 4);
    if (!found) return;

    setSelectValue("customer_id", found.id);

    const foundVehicles = vehicles.filter((vehicle) => vehicle.customer_id === found.id);
    if (foundVehicles.length === 1) {
      window.setTimeout(() => setSelectValue("vehicle_id", foundVehicles[0].id), 0);
    }
  }

  return (
    <section className="orbiq-panel no-print" style={{ marginBottom: 16 }}>
      <div className="orbiq-panel-heading">
        <div>
          <span className="orbiq-eyebrow">CLIENTE EXISTENTE</span>
          <h2>Buscar pelo telefone</h2>
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
          />
        </label>

        {customer ? (
          <div className="orbiq-alert success">
            <strong>{customer.name}</strong>
            {customerVehicles.length === 1
              ? ` • ${[customerVehicles[0].brand, customerVehicles[0].model].filter(Boolean).join(" ")} • ${customerVehicles[0].plate}`
              : customerVehicles.length > 1
                ? ` • ${customerVehicles.length} VEÍCULOS ENCONTRADOS — SELECIONE O VEÍCULO ABAIXO.`
                : " • CLIENTE ENCONTRADO, MAS SEM VEÍCULO CADASTRADO."}
          </div>
        ) : phone ? (
          <div className="orbiq-alert error">NENHUM CLIENTE ENCONTRADO COM ESSE TELEFONE.</div>
        ) : null}
      </div>
    </section>
  );
}
