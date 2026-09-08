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

function digits(value: string | number | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function displayCustomerNumber(value: number) {
  return String(value).padStart(6, "0");
}

function setSelectValue(name: string, value: string) {
  const select = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!select) return;

  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export function CustomerPhoneLookup({ customers, vehicles }: Props) {
  const [customerNumber, setCustomerNumber] = useState("");

  const customer = useMemo(() => {
    const query = digits(customerNumber);
    if (!query) return null;
    return customers.find((item) => digits(item.customer_number) === query) ?? null;
  }, [customers, customerNumber]);

  const customerVehicles = useMemo(
    () => (customer ? vehicles.filter((vehicle) => vehicle.customer_id === customer.id) : []),
    [customer, vehicles],
  );

  function handleCustomerNumberChange(value: string) {
    const query = digits(value);
    setCustomerNumber(query);

    const found = customers.find((item) => digits(item.customer_number) === query);
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
          <h2>Buscar pelo número</h2>
        </div>
      </div>

      <div className="orbiq-form">
        <label>
          <span>Número do cliente</span>
          <input
            value={customerNumber}
            onChange={(event) => handleCustomerNumberChange(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="EX.: 000001"
          />
        </label>

        {customer ? (
          <div className="orbiq-alert success">
            <strong>Nº {displayCustomerNumber(customer.customer_number)} · {customer.name}</strong>
            {customerVehicles.length === 1
              ? ` • ${[customerVehicles[0].brand, customerVehicles[0].model].filter(Boolean).join(" ")} • ${customerVehicles[0].plate}`
              : customerVehicles.length > 1
                ? ` • ${customerVehicles.length} veículos encontrados — selecione o veículo abaixo.`
                : " • Cliente encontrado, mas sem veículo cadastrado."}
          </div>
        ) : customerNumber ? (
          <div className="orbiq-alert error">Nenhum cliente encontrado com esse número.</div>
        ) : null}
      </div>
    </section>
  );
}
