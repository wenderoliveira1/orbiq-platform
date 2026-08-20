"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  getCurrentContext,
} from "../../_lib/current-organization";


type Service = {
  category: string;
  description: string;
  needs_part: boolean;
  labor_amount: null;
};


type Item = {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  side: string | null;
  specification: string | null;
  notes: string | null;
};


function text(
  value: FormDataEntryValue | null,
): string {
  return String(
    value ?? "",
  ).trim();
}


function fail(
  message: string,
): never {
  redirect(
    `/dashboard/orcamentos/novo?error=${encodeURIComponent(
      message,
    )}`,
  );
}


/*
 * CORRECAO TS2366
 *
 * O JSON.parse fica isolado.
 * TODOS os caminhos agora retornam T[] ou never.
 */
function parseArray<T>(
  raw: string,
  label: string,
): T[] {
  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        raw || "[]",
      );
  }
  catch {
    return fail(
      `${label} inválidos. Atualize a página e tente novamente.`,
    );
  }

  if (
    !Array.isArray(
      parsed,
    )
  ) {
    return fail(
      `${label} inválidos.`,
    );
  }

  return parsed as T[];
}


export async function createQuoteAction(
  formData: FormData,
): Promise<never> {
  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const customerId =
    text(
      formData.get(
        "customer_id",
      ),
    );


  const vehicleId =
    text(
      formData.get(
        "vehicle_id",
      ),
    );


  const priority =
    text(
      formData.get(
        "priority",
      ),
    );


  const mileageRaw =
    text(
      formData.get(
        "mileage",
      ),
    );


  const notes =
    text(
      formData.get(
        "notes",
      ),
    );


  const services =
    parseArray<Service>(
      text(
        formData.get(
          "services_json",
        ),
      ),
      "Serviços",
    );


  const items =
    parseArray<Item>(
      text(
        formData.get(
          "items_json",
        ),
      ),
      "Peças",
    );


  if (!customerId) {
    return fail(
      "Selecione o cliente.",
    );
  }


  if (!vehicleId) {
    return fail(
      "Selecione o veículo.",
    );
  }


  if (
    ![
      "normal",
      "customer_waiting",
      "vehicle_stopped",
    ].includes(
      priority,
    )
  ) {
    return fail(
      "Prioridade inválida.",
    );
  }


  if (
    services.length === 0 &&
    items.length === 0
  ) {
    return fail(
      "Adicione pelo menos um serviço ou uma peça.",
    );
  }


  let mileage:
    number | null =
    null;


  if (mileageRaw) {
    const parsedMileage =
      Number(
        mileageRaw,
      );

    if (
      !Number.isInteger(
        parsedMileage,
      ) ||
      parsedMileage < 0
    ) {
      return fail(
        "Quilometragem inválida.",
      );
    }

    mileage =
      parsedMileage;
  }


  const cleanServices =
    services
      .map(
        (service) => ({
          category:
            String(
              service.category ??
                "",
            ).trim() ||
            "Outros",

          description:
            String(
              service.description ??
                "",
            ).trim(),

          needs_part:
            service.needs_part ===
            true,

          labor_amount:
            null,
        }),
      )
      .filter(
        (service) =>
          service.description.length >
          0,
      );


  const cleanItems =
    items
      .map(
        (item) => ({
          category:
            String(
              item.category ??
                "",
            ).trim() ||
            "Outros",

          description:
            String(
              item.description ??
                "",
            ).trim(),

          quantity:
            Number(
              item.quantity,
            ),

          unit:
            String(
              item.unit ??
                "",
            ).trim() ||
            "un",

          side:
            String(
              item.side ??
                "",
            ).trim() ||
            null,

          specification:
            String(
              item.specification ??
                "",
            ).trim() ||
            null,

          notes:
            String(
              item.notes ??
                "",
            ).trim() ||
            null,
        }),
      )
      .filter(
        (item) =>
          item.description.length >
            0 &&
          Number.isFinite(
            item.quantity,
          ) &&
          item.quantity >
            0,
      );


  if (
    cleanServices.length ===
      0 &&
    cleanItems.length ===
      0
  ) {
    return fail(
      "Nenhum serviço ou peça válida foi informado.",
    );
  }


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "create_quote",
      {
        target_org_id:
          organization.id,

        target_customer_id:
          customerId,

        target_vehicle_id:
          vehicleId,

        target_priority:
          priority,

        target_mileage:
          mileage,

        target_notes:
          notes ||
          null,

        services:
          cleanServices,

        items:
          cleanItems,
      },
    );


  if (error) {
    return fail(
      `Não foi possível salvar o orçamento: ${error.message}`,
    );
  }


  const created =
    data?.[0];


  if (
    !created ||
    !created.protocol
  ) {
    return fail(
      "O orçamento foi salvo sem um protocolo válido.",
    );
  }


  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/orcamentos/novo",
  );


  redirect(
    `/dashboard/orcamentos/novo?created=${encodeURIComponent(
      created.protocol,
    )}`,
  );
}