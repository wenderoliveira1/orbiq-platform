import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  buildVisitHistory,
  compactVisitServices,
  lastMileageByVehicleId,
  lastMileageFromVisits,
  novoOrcamentoHref,
} from "../../apps/web/src/app/dashboard/_lib/operational-history";

const STAFF_HISTORY_PATHS = [
  "apps/web/src/app/dashboard/_lib/operational-history.ts",
  "apps/web/src/app/dashboard/_components/operational-history-list.tsx",
  "apps/web/src/app/dashboard/clientes/[id]/page.tsx",
  "apps/web/src/app/dashboard/veiculos/[id]/page.tsx",
] as const;

test.describe("Fase 2.1BI — histórico operacional de cliente e veículo", () => {
  test("helper ordena visitas, ignora o orçamento atual e usa km da visita mais recente", () => {
    const visits = buildVisitHistory({
      quotes: [
        {
          id: "q-old",
          protocol: "ORB-001",
          status: "completed",
          mileage: 40000,
          created_at: "2026-01-10T12:00:00.000Z",
          customer_id: "c1",
          vehicle_id: "v1",
        },
        {
          id: "q-current",
          protocol: "ORB-003",
          status: "estimating",
          mileage: 52000,
          created_at: "2026-09-10T12:00:00.000Z",
          customer_id: "c1",
          vehicle_id: "v1",
        },
        {
          id: "q-mid",
          protocol: "ORB-002",
          status: "approved",
          mileage: 48000,
          created_at: "2026-06-02T12:00:00.000Z",
          customer_id: "c1",
          vehicle_id: "v1",
        },
      ],
      services: [
        { quote_id: "q-old", description: "ALINHAR PARA-LAMA" },
        { quote_id: "q-old", description: "PINTAR PORTA" },
        { quote_id: "q-mid", description: "TROCAR AMORTECEDOR" },
      ],
      excludeQuoteId: "q-current",
      vehicleId: "v1",
    });

    expect(visits.map((visit) => visit.protocol)).toEqual(["ORB-002", "ORB-001"]);
    expect(visits[0].services).toContain("TROCAR AMORTECEDOR");
    expect(lastMileageFromVisits(visits)).toBe(48000);
    expect(lastMileageByVehicleId(visits).v1).toBe(48000);
    expect(compactVisitServices(["A", "B", "C", "D"], 3)).toBe("A · B · C +1");
    expect(novoOrcamentoHref("c1", "v1")).toBe(
      "/dashboard/orcamentos/novo?customer=c1&vehicle=v1",
    );
  });

  test("detalhe do orçamento mostra histórico do veículo só para a equipe e sem print", async () => {
    const detail = await readFile(
      "apps/web/src/app/dashboard/orcamentos/[id]/page.tsx",
      "utf8",
    );

    expect(detail).toContain('data-testid="vehicle-visit-history"');
    expect(detail).toContain("HISTÓRICO DESTE VEÍCULO");
    expect(detail).toContain("OperationalHistoryList");
    expect(detail).toContain('data-testid="quote-vehicle-history-link"');
    expect(detail).toContain('data-testid="quote-customer-history-link"');
    expect(detail).toContain("no-print");
    expect(detail).toContain("novoOrcamentoHref");
    expect(detail).not.toMatch(/\blucro\b/i);
    expect(detail).not.toMatch(/\bmargem\b/i);
  });

  test("Novo Orçamento preenche cliente/veículo e km da última visita", async () => {
    const page = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/page.tsx",
      "utf8",
    );
    const builder = await readFile(
      "apps/web/src/app/dashboard/orcamentos/novo/quote-builder.tsx",
      "utf8",
    );

    expect(page).toContain("initialCustomerId");
    expect(page).toContain("initialVehicleId");
    expect(page).toContain("lastMileageByVehicleId");
    expect(page).toContain("quoteErrorMessage(query.error)");
    expect(page).toContain("<SubmitReliabilityGuard />");
    expect(page).not.toContain("customersResult.error.message");

    expect(builder).toContain("lastMileageByVehicleId[id]");
    expect(builder).toContain('data-testid="quote-builder-vehicle-history"');
    expect(builder).toContain('data-testid="quote-builder-visit-history"');
    expect(builder).toContain("HISTÓRICO DESTE VEÍCULO");
    expect(builder).toContain("readQuoteBuilderDraft");
  });

  test("cadastros e páginas de histórico ligam cliente/placa ao atendimento", async () => {
    const customers = await readFile(
      "apps/web/src/app/dashboard/clientes/page.tsx",
      "utf8",
    );
    const vehicles = await readFile(
      "apps/web/src/app/dashboard/veiculos/page.tsx",
      "utf8",
    );
    const customerHistory = await readFile(
      "apps/web/src/app/dashboard/clientes/[id]/page.tsx",
      "utf8",
    );
    const vehicleHistory = await readFile(
      "apps/web/src/app/dashboard/veiculos/[id]/page.tsx",
      "utf8",
    );
    const css = await readFile("apps/web/src/app/dashboard/dashboard.css", "utf8");

    expect(customers).toContain("Clientes da oficina");
    expect(customers).toContain('data-testid="customer-history-link"');
    expect(vehicles).toContain("Veículos da oficina");
    expect(vehicles).toContain('data-testid="vehicle-history-link"');
    expect(customerHistory).toContain("HISTÓRICO DO CLIENTE");
    expect(customerHistory).toContain('data-testid="customer-history-new-quote"');
    expect(vehicleHistory).toContain("HISTÓRICO DO VEÍCULO");
    expect(vehicleHistory).toContain('data-testid="vehicle-history-new-quote"');
    expect(css).toContain(".ops-history-row");
    expect(css).toContain(".quote-builder-history");
    expect(css).toMatch(/\.ops-history-row\s*\{[^}]*min-height:\s*58px/s);
  });

  test("histórico interno não expõe custo, lucro ou margem", async () => {
    for (const relativePath of STAFF_HISTORY_PATHS) {
      const source = await readFile(relativePath, "utf8");
      expect(source, `${relativePath} não deve citar custo`).not.toMatch(/\bcusto\b/i);
      expect(source, `${relativePath} não deve citar lucro`).not.toMatch(/\blucro\b/i);
      expect(source, `${relativePath} não deve citar margem`).not.toMatch(/\bmargem\b/i);
      expect(source, `${relativePath} não deve usar chosen_amount`).not.toContain("chosen_amount");
      expect(source, `${relativePath} não deve usar final_amount`).not.toContain("final_amount");
    }
  });
});
