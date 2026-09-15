"use client";

import { useMemo, useRef, useState } from "react";

export type OwnerCustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
};

type VehicleHint = {
  customer_id: string;
  plate: string;
};

type Props = {
  customers: OwnerCustomerOption[];
  vehicles?: VehicleHint[];
  name?: string;
  defaultCustomerId?: string;
};

const PAGE_SIZE = 8;

function digits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function fold(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR");
}

export function formatOwnerPhone(phone: string | null | undefined) {
  const raw = digits(phone);
  if (raw.length === 11) return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  if (raw.length === 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  return String(phone ?? "").trim();
}

export function OwnerCustomerPicker({
  customers,
  vehicles = [],
  name = "customer_id",
  defaultCustomerId = "",
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultCustomerId);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const platesByCustomer = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const vehicle of vehicles) {
      const current = map.get(vehicle.customer_id) ?? [];
      if (!current.includes(vehicle.plate)) current.push(vehicle.plate);
      map.set(vehicle.customer_id, current);
    }
    return map;
  }, [vehicles]);

  const selected = customers.find((item) => item.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const text = fold(query).trim();
    const phone = digits(query);
    if (!text) return customers;
    return customers.filter((customer) => {
      if (phone.length >= 3 && digits(customer.phone).includes(phone)) return true;
      return [customer.name, customer.phone, customer.email]
        .filter(Boolean)
        .some((item) => fold(String(item)).includes(text));
    });
  }, [customers, query]);

  const visible = filtered.slice(0, limit);
  const selectedPlates = selected ? platesByCustomer.get(selected.id) ?? [] : [];
  const showResults = Boolean(query.trim()) || (!selected && customers.length <= PAGE_SIZE);

  function choose(id: string) {
    setSelectedId(id);
    setQuery("");
    setLimit(PAGE_SIZE);
    if (!id) window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div className="owner-customer-picker" data-testid="owner-customer-picker">
      <input type="hidden" name={name} value={selectedId} />
      <input
        className="owner-customer-required"
        value={selectedId}
        required
        readOnly
        tabIndex={-1}
        aria-label="Cliente proprietário"
      />

      {selected ? (
        <div className="owner-customer-selected" data-testid="owner-customer-selected">
          <div>
            <strong>{selected.name}</strong>
            <small>
              {formatOwnerPhone(selected.phone) || "SEM TELEFONE"}
              {selectedPlates.length ? ` · ${selectedPlates.slice(0, 3).join(" · ")}` : ""}
            </small>
          </div>
          <button type="button" className="orbiq-secondary-button" onClick={() => choose("")}>
            Trocar
          </button>
        </div>
      ) : null}

      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setLimit(PAGE_SIZE);
        }}
        placeholder="NOME OU TELEFONE"
        aria-label="Buscar cliente por nome ou telefone"
        autoComplete="off"
        data-testid="owner-customer-search"
      />

      {!selected && !query.trim() ? (
        <p className="owner-customer-hint">
          Digite o nome ou o telefone. Homônimos aparecem com o número para não misturar o dono.
        </p>
      ) : null}

      {showResults ? (
        <div className="owner-customer-results" role="listbox" aria-label="Clientes encontrados">
          {visible.length === 0 ? (
            <p className="owner-customer-hint">Nenhum cliente com esse nome ou telefone.</p>
          ) : (
            visible.map((customer) => {
              const plates = platesByCustomer.get(customer.id) ?? [];
              const active = customer.id === selectedId;
              return (
                <button
                  key={customer.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`owner-customer-option${active ? " is-selected" : ""}`}
                  onClick={() => choose(customer.id)}
                >
                  <strong>{customer.name}</strong>
                  <small>
                    {formatOwnerPhone(customer.phone) || customer.email || "SEM TELEFONE"}
                    {plates.length ? ` · ${plates.slice(0, 2).join(" · ")}` : ""}
                  </small>
                </button>
              );
            })
          )}
          {filtered.length > visible.length ? (
            <button
              type="button"
              className="quote-picker-more"
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
            >
              Mostrar mais ({filtered.length - visible.length})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
