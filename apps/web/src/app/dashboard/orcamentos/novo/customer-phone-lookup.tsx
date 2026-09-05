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

function setSelectValue(name: string, value: string) {
  const select = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!select) return;

  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;

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
    setPhone(value);
    const found = customers.find((item) => digits(item.phone) === digits(value) && digits(value).length >= 4);

    if (!found) return;

    setSelectValue("customer_id", found.id);

    if (customerVehicles.length === 1) {
      window.setTimeout(() => setSelectValue("vehicle_id", customerVehicles[0].id), 0);
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
            placeholder="Digite o telefone cadastrado"
          />
        </label>

        {customer ? (
          <div className="orbiq-alert success">
            <strong>{customer.name}</strong>
            {customerVehicles.length === 1
              ? ` • ${[customerVehicles[0].brand, customerVehicles[0].model].filter(Boolean).join(" ")} • ${customerVehicles[0].plate}`
              : customerVehicles.length > 1
                ? ` • ${customerVehicles.length} veículos encontrados — selecione o veículo abaixo.`
                : " • Cliente encontrado, mas sem veículo cadastrado."}
          </div>
        ) : digits(phone).length >= 4 ? (
          <div className="orbiq-alert error">Nenhum cliente encontrado com esse telefone.</div>
        ) : null}
      </div>
    </section>
  );
}
