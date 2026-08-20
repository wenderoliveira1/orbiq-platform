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


function text(
  value:
    FormDataEntryValue |
    null,
): string {

  return String(
    value ??
      "",
  ).trim();
}


function fail(
  workOrderId:
    string,

  message:
    string,
): never {

  redirect(
    `/dashboard/execucao/${workOrderId}?error=${encodeURIComponent(
      message,
    )}`,
  );
}


function success(
  workOrderId:
    string,

  message:
    string,
): never {

  redirect(
    `/dashboard/execucao/${workOrderId}?ok=${encodeURIComponent(
      message,
    )}`,
  );
}


async function refresh(
  quoteId:
    string,

  workOrderId:
    string,
) {

  revalidatePath(
    "/dashboard",
  );

  revalidatePath(
    "/dashboard/execucao",
  );

  revalidatePath(
    `/dashboard/execucao/${workOrderId}`,
  );

  revalidatePath(
    "/dashboard/orcamentos",
  );

  revalidatePath(
    `/dashboard/orcamentos/${quoteId}`,
  );
}


export async function setLaborAction(
  formData:
    FormData,
): Promise<never> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const workOrderId =
    text(
      formData.get(
        "work_order_id",
      ),
    );


  const quoteId =
    text(
      formData.get(
        "quote_id",
      ),
    );


  const serviceId =
    text(
      formData.get(
        "work_order_service_id",
      ),
    );


  const laborServiceId =
    text(
      formData.get(
        "labor_service_id",
      ),
    );


  if (
    !workOrderId ||
    !quoteId ||
    !serviceId ||
    !laborServiceId
  ) {

    redirect(
      "/dashboard/execucao",
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "set_work_order_service_labor",
      {
        target_org_id:
          organization.id,

        target_work_order_service_id:
          serviceId,

        target_labor_service_id:
          laborServiceId,
      },
    );


  if (error) {

    return fail(
      workOrderId,
      `Não foi possível vincular a mão de obra: ${error.message}`,
    );
  }


  await refresh(
    quoteId,
    workOrderId,
  );


  return success(
    workOrderId,
    "Mão de obra vinculada ao serviço.",
  );
}


export async function startServiceAction(
  formData:
    FormData,
): Promise<never> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const workOrderId =
    text(
      formData.get(
        "work_order_id",
      ),
    );


  const quoteId =
    text(
      formData.get(
        "quote_id",
      ),
    );


  const serviceId =
    text(
      formData.get(
        "work_order_service_id",
      ),
    );


  if (
    !workOrderId ||
    !quoteId ||
    !serviceId
  ) {

    redirect(
      "/dashboard/execucao",
    );
  }


  const {
    error,
  } =
    await supabase.rpc(
      "start_work_order_service",
      {
        target_org_id:
          organization.id,

        target_work_order_service_id:
          serviceId,
      },
    );


  if (error) {

    const message =
      error.message.includes(
        "awaiting parts",
      )
        ? "O veículo ainda está aguardando peças. A execução permanece bloqueada."
        : `Não foi possível iniciar o serviço: ${error.message}`;


    return fail(
      workOrderId,
      message,
    );
  }


  await refresh(
    quoteId,
    workOrderId,
  );


  return success(
    workOrderId,
    "Serviço iniciado.",
  );
}


export async function completeServiceAction(
  formData:
    FormData,
): Promise<never> {

  const {
    supabase,
    organization,
  } =
    await getCurrentContext();


  const workOrderId =
    text(
      formData.get(
        "work_order_id",
      ),
    );


  const quoteId =
    text(
      formData.get(
        "quote_id",
      ),
    );


  const serviceId =
    text(
      formData.get(
        "work_order_service_id",
      ),
    );


  if (
    !workOrderId ||
    !quoteId ||
    !serviceId
  ) {

    redirect(
      "/dashboard/execucao",
    );
  }


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "complete_work_order_service",
      {
        target_org_id:
          organization.id,

        target_work_order_service_id:
          serviceId,
      },
    );


  if (error) {

    return fail(
      workOrderId,
      `Não foi possível concluir o serviço: ${error.message}`,
    );
  }


  await refresh(
    quoteId,
    workOrderId,
  );


  return success(
    workOrderId,
    data ===
      "completed"
      ? "Serviço concluído. Todos os serviços da OS foram finalizados."
      : "Serviço concluído.",
  );
}