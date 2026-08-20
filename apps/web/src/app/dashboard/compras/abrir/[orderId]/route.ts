import {
  NextResponse,
} from "next/server";

import {
  getCurrentContext,
} from "../../../_lib/current-organization";


type RouteContext = {

  params:
    Promise<{
      orderId:
        string;
    }>;
};


function quantity(
  value:
    number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      maximumFractionDigits:
        3,
    },
  ).format(
    value,
  );
}


function currency(
  value:
    number,
): string {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    },
  ).format(
    value,
  );
}


export async function GET(
  request:
    Request,

  context:
    RouteContext,
) {

  const {
    orderId,
  } =
    await context.params;


  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const {
    data: order,
    error: orderError,
  } =
    await supabase
      .from("purchase_orders")
      .select(
        "id, quote_id, supplier_id, code, status, total_amount",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        orderId,
      )
      .maybeSingle();


  if (
    orderError ||
    !order
  ) {

    return NextResponse.redirect(
      new URL(
        "/dashboard/compras",
        request.url,
      ),
    );
  }


  const [
    quoteResult,
    supplierResult,
    itemsResult,
  ] =
    await Promise.all([

      supabase
        .from("quotes")
        .select(
          "id, protocol, vehicle_id",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "id",
          order.quote_id,
        )
        .maybeSingle(),

      supabase
        .from("suppliers")
        .select(
          "id, name, whatsapp, active",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "id",
          order.supplier_id,
        )
        .maybeSingle(),

      supabase
        .from("purchase_order_items")
        .select(
          "id, description, quantity, unit, side, specification, unit_amount, total_amount",
        )
        .eq(
          "organization_id",
          organization.id,
        )
        .eq(
          "order_id",
          order.id,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),
    ]);


  const quote =
    quoteResult.data;


  const supplier =
    supplierResult.data;


  const items =
    itemsResult.data ??
    [];


  if (
    quoteResult.error ||
    !quote ||
    supplierResult.error ||
    !supplier ||
    itemsResult.error
  ) {

    return NextResponse.redirect(
      new URL(
        `/dashboard/compras/${order.id}?error=${encodeURIComponent(
          "Não foi possível preparar o pedido.",
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
    !supplier.active ||
    whatsapp.length <
      10 ||
    whatsapp.length >
      15
  ) {

    return NextResponse.redirect(
      new URL(
        `/dashboard/compras/${order.id}?error=${encodeURIComponent(
          "Fornecedor está sem WhatsApp válido.",
        )}`,
        request.url,
      ),
    );
  }


  const {
    data: vehicle,
  } =
    await supabase
      .from("vehicles")
      .select(
        "id, plate, brand, model, version",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "id",
        quote.vehicle_id,
      )
      .maybeSingle();


  const vehicleName =
    [
      vehicle?.brand,
      vehicle?.model,
      vehicle?.version,
    ]
      .filter(Boolean)
      .join(" ");


  const itemLines =
    items.map(
      (item) => {

        const complement =
          [
            item.side,
            item.specification,
          ]
            .filter(Boolean)
            .join(" · ");


        return (
          `• ${quantity(
            item.quantity,
          )} ${item.unit} — ` +
          `${item.description}` +
          (
            complement
              ? ` (${complement})`
              : ""
          ) +
          ` — ${currency(
            item.total_amount,
          )}`
        );
      },
    );


  const message =
    [
      "Olá, tudo bem?",

      "",

      "Confirmamos o pedido abaixo para nossa oficina.",

      "",

      `Pedido: ${order.code}`,

      `Protocolo: ${quote.protocol}`,

      `Veículo: ${vehicleName || "Não informado"}`,

      `Placa: ${vehicle?.plate ?? "Não informada"}`,

      "",

      "Itens:",

      ...itemLines,

      "",

      `Total: ${currency(
        order.total_amount,
      )}`,

      "",

      "Por favor, confirme o pedido e a previsão de entrega.",

      "",

      "Obrigado!",
    ].join(
      "\n",
    );


  const {
    error: markError,
  } =
    await supabase.rpc(
      "mark_purchase_order_ordered",
      {
        target_org_id:
          organization.id,

        target_order_id:
          order.id,
      },
    );


  if (
    markError
  ) {

    return NextResponse.redirect(
      new URL(
        `/dashboard/compras/${order.id}?error=${encodeURIComponent(
          `Não foi possível confirmar o pedido: ${markError.message}`,
        )}`,
        request.url,
      ),
    );
  }


  const whatsappUrl =
    `https://wa.me/${whatsapp}?text=${encodeURIComponent(
      message,
    )}`;


  return NextResponse.redirect(
    whatsappUrl,
  );
}