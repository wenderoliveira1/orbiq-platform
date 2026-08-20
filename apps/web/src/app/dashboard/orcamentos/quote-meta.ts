export const QUOTE_STATUSES = [
  {
    value: "awaiting_evaluation",
    label: "Aguardando avaliação",
  },
  {
    value: "awaiting_quote",
    label: "Aguardando cotação",
  },
  {
    value: "estimating",
    label: "Em orçamento",
  },
  {
    value: "approved",
    label: "Aprovado",
  },
  {
    value: "rejected",
    label: "Reprovado",
  },
  {
    value: "awaiting_parts",
    label: "Aguardando peças",
  },
  {
    value: "in_progress",
    label: "Em execução",
  },
  {
    value: "completed",
    label: "Finalizado",
  },
] as const;


export const PRIORITY_LABELS:
  Record<string, string> = {
    normal: "Normal",

    customer_waiting:
      "Cliente aguardando",

    vehicle_stopped:
      "Veículo parado",
  };


export function statusLabel(
  value: string,
): string {
  return (
    QUOTE_STATUSES.find(
      (status) =>
        status.value === value,
    )?.label ??
    value
  );
}