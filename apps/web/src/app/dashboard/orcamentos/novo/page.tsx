import { getCurrentContext } from "../../_lib/current-organization";

import { CustomerPhoneLookup } from "./customer-phone-lookup";
import { QuoteBuilder } from "./quote-builder";
import { quoteErrorMessage } from "./quote-errors";
import { SubmitReliabilityGuard } from "./submit-reliability-guard";
import { UnsavedQuoteGuard } from "./unsaved-quote-guard";

type SearchParams = Promise<{
  error?: string;
}>;

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const { supabase, organization } = await getCurrentContext();

  const [customersResult, vehiclesResult, laborResult, servicesResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
    supabase
      .from("vehicles")
      .select("id, customer_id, plate, brand, model, version, model_year, mileage")
      .eq("organization_id", organization.id)
      .order("plate", { ascending: true }),
    supabase
      .from("labor_services")
      .select("id, description, category, amount")
      .eq("organization_id", organization.id)
      .eq("active", true)
      .order("description", { ascending: true }),
    supabase
      .from("service_catalog")
      .select("id, category, description, default_labor_amount")
      .eq("organization_id", organization.id)
      .eq("active", true)
      .order("category", { ascending: true })
      .order("description", { ascending: true }),
  ]);

  if (customersResult.error || vehiclesResult.error || laborResult.error || servicesResult.error) {
    throw new Error("Não foi possível carregar os dados do novo orçamento.");
  }

  return (
    <>
      <UnsavedQuoteGuard />
      <SubmitReliabilityGuard />

      <CustomerPhoneLookup customers={customersResult.data ?? []} vehicles={vehiclesResult.data ?? []} />

      <QuoteBuilder
        customers={customersResult.data ?? []}
        vehicles={vehiclesResult.data ?? []}
        laborServices={laborResult.data ?? []}
        serviceCatalog={servicesResult.data ?? []}
        errorMessage={quoteErrorMessage(query.error)}
      />
    </>
  );
}
