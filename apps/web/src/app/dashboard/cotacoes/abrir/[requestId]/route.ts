import {
  NextResponse,
} from "next/server";

import {
  getCurrentContext,
} from "../../../_lib/current-organization";


type RouteContext = {
  params:
    Promise<{
      requestId: string;
    }>;
};


export async function GET(
  request: Request,
  context: RouteContext,
) {
  const {
    requestId,
  } =
    await context.params;


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    data: quoteRequest,
    error: requestError,
  } =
    await supabase
      .from("quote_supplier_requests")
      .select(
        "id, quote_id, supplier_id, message, status",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        requestId,
      )
      .maybeSingle();


  if (
    requestError ||
    !quoteRequest
  ) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/cotacoes",
        request.url,
      ),
    );
  }


  const {
    data: supplier,
    error: supplierError,
  } =
    await supabase
      .from("suppliers")
      .select(
        "id, whatsapp, active",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        quoteRequest.supplier_id,
      )
      .maybeSingle();


  if (
    supplierError ||
    !supplier ||
    !supplier.active
  ) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/cotacoes/${quoteRequest.quote_id}?error=${encodeURIComponent(
          "Fornecedor inválido ou inativo.",
        )}`,
        request.url,
      ),
    );
  }


  const whatsapp =
    String(
      supplier.whatsapp ??
        "",
    ).replace(
      /\D/g,
      "",
    );


  if (
    whatsapp.length <
      10 ||
    whatsapp.length >
      15
  ) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/cotacoes/${quoteRequest.quote_id}?error=${encodeURIComponent(
          "Fornecedor está sem WhatsApp válido.",
        )}`,
        request.url,
      ),
    );
  }


  if (
    quoteRequest.status ===
      "prepared"
  ) {
    await supabase
      .from("quote_supplier_requests")
      .update({
        status:
          "opened",

        opened_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        quoteRequest.id,
      );
  }


  const whatsappUrl =
    `https://wa.me/${whatsapp}?text=${encodeURIComponent(
      quoteRequest.message,
    )}`;


  return NextResponse.redirect(
    whatsappUrl,
  );
}