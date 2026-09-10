/** Funilaria guided catalog — 2-step: ação → peça/lado. PT-BR uppercase composition. */

export const FUNILARIA_CATEGORY = "FUNILARIA";

export type FunilariaAction = {
  id: string;
  label: string;
  /** Verb used in composed description, e.g. ALINHAR */
  verb: string;
  /** Voice / search aliases (normalized lowercase without diacritics) */
  aliases: string[];
};

export type FunilariaPart = {
  id: string;
  label: string;
  /** Phrase used in composed description, e.g. PARA-LAMA ESQUERDO */
  phrase: string;
  aliases: string[];
};

export const FUNILARIA_ACTIONS: FunilariaAction[] = [
  { id: "cortar", label: "Cortar", verb: "CORTAR", aliases: ["cortar", "corte"] },
  { id: "retocar", label: "Retocar", verb: "RETOCAR", aliases: ["retocar", "retoque"] },
  { id: "desamassar", label: "Desamassar", verb: "DESAMASSAR", aliases: ["desamassar", "desamassado", "bater chapa", "bater"] },
  { id: "recuperar", label: "Recuperar", verb: "RECUPERAR", aliases: ["recuperar", "recuperacao"] },
  { id: "alinhar", label: "Alinhar", verb: "ALINHAR", aliases: ["alinhar", "alinhamento de chapa", "alinhar chapa"] },
  { id: "pintar", label: "Pintar", verb: "PINTAR", aliases: ["pintar", "pintura", "repintura"] },
  { id: "trocar", label: "Trocar", verb: "TROCAR", aliases: ["trocar", "substituir", "substituicao"] },
  { id: "soldar", label: "Soldar", verb: "SOLDAR", aliases: ["soldar", "solda"] },
  { id: "polir", label: "Polir", verb: "POLIR", aliases: ["polir", "polimento"] },
];

export const FUNILARIA_PARTS: FunilariaPart[] = [
  { id: "lateral-e", label: "Lateral esquerda", phrase: "LATERAL ESQUERDA", aliases: ["lateral esquerda", "lateral e"] },
  { id: "lateral-d", label: "Lateral direita", phrase: "LATERAL DIREITA", aliases: ["lateral direita", "lateral d"] },
  { id: "porta-de", label: "Porta dianteira E", phrase: "PORTA DIANTEIRA ESQUERDA", aliases: ["porta dianteira esquerda", "porta dianteira e"] },
  { id: "porta-dd", label: "Porta dianteira D", phrase: "PORTA DIANTEIRA DIREITA", aliases: ["porta dianteira direita", "porta dianteira d"] },
  { id: "porta-te", label: "Porta traseira E", phrase: "PORTA TRASEIRA ESQUERDA", aliases: ["porta traseira esquerda", "porta traseira e"] },
  { id: "porta-td", label: "Porta traseira D", phrase: "PORTA TRASEIRA DIREITA", aliases: ["porta traseira direita", "porta traseira d"] },
  { id: "parachoque-d", label: "Para-choque dianteiro", phrase: "PARA-CHOQUE DIANTEIRO", aliases: ["para-choque dianteiro", "parachoque dianteiro", "para choque dianteiro"] },
  { id: "parachoque-t", label: "Para-choque traseiro", phrase: "PARA-CHOQUE TRASEIRO", aliases: ["para-choque traseiro", "parachoque traseiro", "para choque traseiro"] },
  { id: "paralama-e", label: "Para-lama E", phrase: "PARA-LAMA ESQUERDO", aliases: ["para-lama esquerdo", "paralama esquerdo", "para lama esquerdo", "para-lama e"] },
  { id: "paralama-d", label: "Para-lama D", phrase: "PARA-LAMA DIREITO", aliases: ["para-lama direito", "paralama direito", "para lama direito", "para-lama d"] },
  { id: "capo", label: "Capô", phrase: "CAPÔ", aliases: ["capo", "capô"] },
  { id: "porta-malas", label: "Porta-malas", phrase: "PORTA-MALAS", aliases: ["porta-malas", "porta malas", "tampa traseira"] },
  { id: "teto", label: "Teto", phrase: "TETO", aliases: ["teto"] },
  { id: "coluna", label: "Coluna", phrase: "COLUNA", aliases: ["coluna", "coluna a", "coluna b", "coluna c"] },
  { id: "saia", label: "Saia / soleira", phrase: "SAIA", aliases: ["saia", "soleira"] },
  { id: "retrovisor-e", label: "Retrovisor E", phrase: "RETROVISOR ESQUERDO", aliases: ["retrovisor esquerdo", "retrovisor e"] },
  { id: "retrovisor-d", label: "Retrovisor D", phrase: "RETROVISOR DIREITO", aliases: ["retrovisor direito", "retrovisor d"] },
  { id: "painel", label: "Painel frontal", phrase: "PAINEL FRONTAL", aliases: ["painel", "painel frontal"] },
];

export function composeFunilariaDescription(actionVerb: string, partPhrase: string): string {
  return `${actionVerb.trim().toLocaleUpperCase("pt-BR")} — ${partPhrase.trim().toLocaleUpperCase("pt-BR")}`;
}

function strip(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/** Best-effort match from free text (voice) into funilaria action + part. */
export function matchFunilariaFromTranscript(transcript: string): {
  action: FunilariaAction | null;
  part: FunilariaPart | null;
  description: string | null;
} {
  const normalized = strip(transcript);
  let action: FunilariaAction | null = null;
  let part: FunilariaPart | null = null;

  for (const candidate of FUNILARIA_ACTIONS) {
    if (candidate.aliases.some((alias) => normalized.includes(strip(alias)))) {
      action = candidate;
      break;
    }
  }

  // Longer aliases first for parts
  const partsByAliasLen = [...FUNILARIA_PARTS].sort(
    (a, b) => Math.max(...b.aliases.map((x) => x.length)) - Math.max(...a.aliases.map((x) => x.length)),
  );
  for (const candidate of partsByAliasLen) {
    if (candidate.aliases.some((alias) => normalized.includes(strip(alias)))) {
      part = candidate;
      break;
    }
  }

  if (action && part) {
    return {
      action,
      part,
      description: composeFunilariaDescription(action.verb, part.phrase),
    };
  }
  return { action, part, description: null };
}
