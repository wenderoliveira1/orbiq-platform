import {
  getCurrentContext,
} from "../../_lib/current-organization";

import {
  QuoteBuilder,
} from "./quote-builder";

import {
  UnsavedQuoteGuard,
} from "./unsaved-quote-guard";


type SearchParams =
  Promise<{
    error?: string;
  }>;


export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query =
    await searchParams;


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const [
    customersResult,
    vehiclesResult,
    laborResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "customers",
        )
        .select(
          "id, name, phone",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .order(
          "name",
          {
            ascending: true,
          },
        ),

      supabase
        .from(
          "vehicles",
        )
        .select(
          "id, customer_id, plate, brand, model, version, model_year, mileage",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .order(
          "plate",
          {
            ascending: true,
          },
        ),

      supabase
        .from(
          "labor_services",
        )
        .select(
          "id, description, category, amount",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "active",
          true,
        )
        .order(
          "description",
          {
            ascending: true,
          },
        ),
    ]);


  if (
    customersResult.error
  ) {
    throw new Error(
      customersResult.error.message,
    );
  }


  if (
    vehiclesResult.error
  ) {
    throw new Error(
      vehiclesResult.error.message,
    );
  }


  if (
    laborResult.error
  ) {
    throw new Error(
      laborResult.error.message,
    );
  }


  return (
    <>
      <UnsavedQuoteGuard />

      <QuoteBuilder
        customers={
          customersResult.data ??
          []
        }
        vehicles={
          vehiclesResult.data ??
          []
        }
        laborServices={
          laborResult.data ??
          []
        }
        errorMessage={
          query.error
        }
      />
    </>
  );
}