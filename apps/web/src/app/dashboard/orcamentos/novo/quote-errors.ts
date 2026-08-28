export const quoteErrorMessages = {
  customer_required: "Selecione um cliente.",
  vehicle_required: "Selecione um veículo.",
  mileage_required: "Informe a quilometragem do veículo.",
  payload_invalid: "Os dados do orçamento estão inválidos. Revise os campos e tente novamente.",
  service_required: "Adicione pelo menos um serviço.",
  items_invalid: "A lista de peças está inválida.",
  save_failed: "Não foi possível salvar o orçamento. Tente novamente.",
  result_invalid: "O orçamento não pôde ser confirmado após o salvamento. Tente novamente.",
} as const;

export type QuoteErrorCode = keyof typeof quoteErrorMessages;

export function quoteErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;

  if (Object.prototype.hasOwnProperty.call(quoteErrorMessages, code)) {
    return quoteErrorMessages[code as QuoteErrorCode];
  }

  return "Não foi possível concluir a operação. Tente novamente.";
}
