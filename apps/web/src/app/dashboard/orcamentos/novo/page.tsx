import { getCurrentContext } from "../../_lib/current-organization";
import {
  buildVisitHistory,
  lastMileageByVehicleId,
} from "../../_lib/operational-history";

import { CustomerPhoneLookup } from "./customer-phone-lookup";
import { QuoteBuilder } from "./quote-builder";
import { quoteErrorMessage } from "./quote-errors";
import { SubmitReliabilityGuard } from "./submit-reliability-guard";
import { UnsavedQuoteGuard } from "./unsaved-quote-guard";

type SearchParams = Promise<{
  error?: string;
  customer?: string;
  vehicle?: string;
}>;

export default async function NewQuotePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const { supabase, organization, user } = await getCurrentContext();

  const [customersResult, vehiclesResult, servicesResult, quotesResult] = await Promise.all([
    supabase.from("customers").select("id, name, phone").eq("organization_id", organization.id).order("name", { ascending: true }),
    supabase.from("vehicles").select("id, customer_id, plate, brand, model, version, model_year, mileage").eq("organization_id", organization.id).order("plate", { ascending: true }),
    supabase.from("service_catalog").select("id, category, description, default_labor_amount, requires_part").eq("organization_id", organization.id).eq("active", true).order("category", { ascending: true }).order("description", { ascending: true }),
    supabase.from("quotes").select("id, protocol, status, mileage, created_at, customer_id, vehicle_id").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(120),
  ]);

  if (customersResult.error || vehiclesResult.error || servicesResult.error || quotesResult.error) {
    throw new Error("Não foi possível carregar os dados do novo orçamento.");
  }

  const customers = customersResult.data ?? [];
  const vehicles = vehiclesResult.data ?? [];
  const recentQuotes = quotesResult.data ?? [];
  const quoteIds = recentQuotes.map((quote) => quote.id);
  const servicesHistoryResult = quoteIds.length
    ? await supabase
        .from("quote_services")
        .select("quote_id, description")
        .eq("organization_id", organization.id)
        .in("quote_id", quoteIds)
    : { data: [], error: null };

  if (servicesHistoryResult.error) {
    throw new Error("Não foi possível carregar o histórico recente.");
  }

  const visits = buildVisitHistory({
    quotes: recentQuotes,
    services: servicesHistoryResult.data ?? [],
    limit: 120,
  });
  const mileageByVehicle = lastMileageByVehicleId(visits);

  const requestedCustomerId = String(query.customer ?? "").trim();
  const requestedVehicleId = String(query.vehicle ?? "").trim();
  const initialCustomerId = customers.some((customer) => customer.id === requestedCustomerId)
    ? requestedCustomerId
    : "";
  const initialVehicle = vehicles.find((vehicle) => vehicle.id === requestedVehicleId);
  const initialVehicleId =
    initialVehicle && (!initialCustomerId || initialVehicle.customer_id === initialCustomerId)
      ? initialVehicle.id
      : "";
  const resolvedCustomerId = initialCustomerId || initialVehicle?.customer_id || "";

  return (
    <>
      <UnsavedQuoteGuard />
      <SubmitReliabilityGuard />
      <CustomerPhoneLookup customers={customers} vehicles={vehicles} />
      <QuoteBuilder
        customers={customers}
        vehicles={vehicles}
        serviceCatalog={servicesResult.data ?? []}
        organizationId={organization.id}
        userId={user.id}
        errorMessage={quoteErrorMessage(query.error)}
        initialCustomerId={resolvedCustomerId}
        initialVehicleId={initialVehicleId}
        lastMileageByVehicleId={mileageByVehicle}
        recentVisits={visits}
      />
    </>
  );
}
