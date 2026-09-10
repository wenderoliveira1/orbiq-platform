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

/** Professional body-shop verbs — Pintura stays here as "pintar" (one Funilaria flow). */
export const FUNILARIA_ACTIONS: FunilariaAction[] = [
  {
    id: "alinhar",
    label: "Alinhar",
    verb: "ALINHAR",
    aliases: ["alinhar chapa", "alinhamento de chapa", "alinhar", "alinhe"],
  },
  {
    id: "desamassar",
    label: "Desamassar",
    verb: "DESAMASSAR",
    aliases: ["desamassar", "desamassado", "bater chapa", "bater a chapa", "bater", "amassar"],
  },
  {
    id: "retocar",
    label: "Retocar",
    verb: "RETOCAR",
    aliases: ["retocar", "retoque", "fazer retoque"],
  },
  {
    id: "recuperar",
    label: "Recuperar",
    verb: "RECUPERAR",
    aliases: ["recuperar", "recuperacao", "recuperação"],
  },
  {
    id: "cortar",
    label: "Cortar",
    verb: "CORTAR",
    aliases: ["cortar", "corte", "fazer corte"],
  },
  {
    id: "pintar",
    label: "Pintar",
    verb: "PINTAR",
    aliases: ["pintar", "pintura", "repintura", "pintura completa"],
  },
  {
    id: "trocar",
    label: "Trocar",
    verb: "TROCAR",
    aliases: ["trocar", "substituir", "substituicao", "substituição"],
  },
  {
    id: "soldar",
    label: "Soldar",
    verb: "SOLDAR",
    aliases: ["soldar", "solda", "fazer solda"],
  },
  {
    id: "polir",
    label: "Polir",
    verb: "POLIR",
    aliases: ["polir", "polimento", "fazer polimento"],
  },
];

export const FUNILARIA_PARTS: FunilariaPart[] = [
  {
    id: "lateral-e",
    label: "Lateral E",
    phrase: "LATERAL ESQUERDA",
    aliases: [
      "lateral esquerda",
      "lateral e",
      "lateral do lado esquerdo",
      "lateral lado esquerdo",
      "lateral motorista",
    ],
  },
  {
    id: "lateral-d",
    label: "Lateral D",
    phrase: "LATERAL DIREITA",
    aliases: [
      "lateral direita",
      "lateral d",
      "lateral do lado direito",
      "lateral lado direito",
      "lateral passageiro",
    ],
  },
  {
    id: "porta-de",
    label: "Porta dianteira E",
    phrase: "PORTA DIANTEIRA ESQUERDA",
    aliases: [
      "porta dianteira esquerda",
      "porta dianteira e",
      "porta da frente esquerda",
      "porta frente esquerda",
      "porta diant e",
    ],
  },
  {
    id: "porta-dd",
    label: "Porta dianteira D",
    phrase: "PORTA DIANTEIRA DIREITA",
    aliases: [
      "porta dianteira direita",
      "porta dianteira d",
      "porta da frente direita",
      "porta frente direita",
      "porta diant d",
    ],
  },
  {
    id: "porta-te",
    label: "Porta traseira E",
    phrase: "PORTA TRASEIRA ESQUERDA",
    aliases: [
      "porta traseira esquerda",
      "porta traseira e",
      "porta de tras esquerda",
      "porta de trás esquerda",
      "porta tras e",
    ],
  },
  {
    id: "porta-td",
    label: "Porta traseira D",
    phrase: "PORTA TRASEIRA DIREITA",
    aliases: [
      "porta traseira direita",
      "porta traseira d",
      "porta de tras direita",
      "porta de trás direita",
      "porta tras d",
    ],
  },
  {
    id: "parachoque-d",
    label: "Para-choque dianteiro",
    phrase: "PARA-CHOQUE DIANTEIRO",
    aliases: [
      "para-choque dianteiro",
      "parachoque dianteiro",
      "para choque dianteiro",
      "para-choque da frente",
      "parachoque da frente",
      "para-choque dianteira",
      "parachoque dianteira",
    ],
  },
  {
    id: "parachoque-t",
    label: "Para-choque traseiro",
    phrase: "PARA-CHOQUE TRASEIRO",
    aliases: [
      "para-choque traseiro",
      "parachoque traseiro",
      "para choque traseiro",
      "para-choque de tras",
      "para-choque de trás",
      "parachoque de tras",
      "para-choque traseira",
      "parachoque traseira",
    ],
  },
  {
    id: "paralama-e",
    label: "Para-lama E",
    phrase: "PARA-LAMA ESQUERDO",
    aliases: [
      "para-lama esquerdo",
      "paralama esquerdo",
      "para lama esquerdo",
      "para-lama e",
      "paralama e",
      "para-lama do lado esquerdo",
      "paralama do lado esquerdo",
      "para-lama esquerda",
      "paralama esquerda",
    ],
  },
  {
    id: "paralama-d",
    label: "Para-lama D",
    phrase: "PARA-LAMA DIREITO",
    aliases: [
      "para-lama direito",
      "paralama direito",
      "para lama direito",
      "para-lama d",
      "paralama d",
      "para-lama do lado direito",
      "paralama do lado direito",
      "para-lama direita",
      "paralama direita",
    ],
  },
  {
    id: "capo",
    label: "Capô",
    phrase: "CAPÔ",
    aliases: ["capo", "capô", "tampa do motor", "tampa dianteira"],
  },
  {
    id: "porta-malas",
    label: "Porta-malas",
    phrase: "PORTA-MALAS",
    aliases: ["porta-malas", "porta malas", "portamalas", "bagageiro"],
  },
  {
    id: "tampa-traseira",
    label: "Tampa traseira",
    phrase: "TAMPA TRASEIRA",
    aliases: ["tampa traseira", "tampa de tras", "tampa de trás", "tampa tras"],
  },
  {
    id: "teto",
    label: "Teto",
    phrase: "TETO",
    aliases: ["teto", "teto do carro"],
  },
  {
    id: "coluna-a",
    label: "Coluna A",
    phrase: "COLUNA A",
    aliases: ["coluna a", "coluna aa", "coluna dianteira"],
  },
  {
    id: "coluna-b",
    label: "Coluna B",
    phrase: "COLUNA B",
    aliases: ["coluna b", "coluna bb", "coluna central", "coluna do meio"],
  },
  {
    id: "coluna-c",
    label: "Coluna C",
    phrase: "COLUNA C",
    aliases: ["coluna c", "coluna cc", "coluna traseira"],
  },
  {
    id: "soleira",
    label: "Soleira",
    phrase: "SOLEIRA",
    aliases: ["soleira", "soleiras"],
  },
  {
    id: "saia",
    label: "Saia",
    phrase: "SAIA",
    aliases: ["saia", "saia lateral"],
  },
  {
    id: "painel-frontal",
    label: "Painel frontal",
    phrase: "PAINEL FRONTAL",
    aliases: ["painel frontal", "painel da frente", "painel dianteiro", "painel"],
  },
  {
    id: "painel-traseiro",
    label: "Painel traseiro",
    phrase: "PAINEL TRASEIRO",
    aliases: ["painel traseiro", "painel de tras", "painel de trás", "painel tras"],
  },
  {
    id: "retrovisor-e",
    label: "Retrovisor E",
    phrase: "RETROVISOR ESQUERDO",
    aliases: [
      "retrovisor esquerdo",
      "retrovisor e",
      "retrovisor do lado esquerdo",
      "espelho esquerdo",
    ],
  },
  {
    id: "retrovisor-d",
    label: "Retrovisor D",
    phrase: "RETROVISOR DIREITO",
    aliases: [
      "retrovisor direito",
      "retrovisor d",
      "retrovisor do lado direito",
      "espelho direito",
    ],
  },
  {
    id: "grade",
    label: "Grade",
    phrase: "GRADE",
    aliases: ["grade", "grade frontal", "grade dianteira"],
  },
  {
    id: "assoalho",
    label: "Assoalho",
    phrase: "ASSOALHO",
    aliases: ["assoalho", "assoalho do carro"],
  },
];

export function composeFunilariaDescription(actionVerb: string, partPhrase: string): string {
  return `${actionVerb.trim().toLocaleUpperCase("pt-BR")} — ${partPhrase.trim().toLocaleUpperCase("pt-BR")}`;
}

function strip(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function bestAliasMatch<T extends { aliases: string[] }>(
  normalized: string,
  candidates: T[],
): T | null {
  let best: T | null = null;
  let bestLen = 0;
  for (const candidate of candidates) {
    for (const alias of candidate.aliases) {
      const needle = strip(alias);
      if (!needle) continue;
      if (normalized.includes(needle) && needle.length > bestLen) {
        best = candidate;
        bestLen = needle.length;
      }
    }
  }
  return best;
}

/** Best-effort match from free text (voice) into funilaria action + part. */
export function matchFunilariaFromTranscript(transcript: string): {
  action: FunilariaAction | null;
  part: FunilariaPart | null;
  description: string | null;
} {
  const normalized = strip(transcript);
  const action = bestAliasMatch(normalized, FUNILARIA_ACTIONS);
  const part = bestAliasMatch(normalized, FUNILARIA_PARTS);

  if (action && part) {
    return {
      action,
      part,
      description: composeFunilariaDescription(action.verb, part.phrase),
    };
  }
  return { action, part, description: null };
}

/** Stable ids for AutoQA / coverage checks. */
export const FUNILARIA_REQUIRED_ACTION_IDS = [
  "alinhar",
  "desamassar",
  "retocar",
  "recuperar",
  "cortar",
  "pintar",
  "trocar",
  "soldar",
  "polir",
] as const;

export const FUNILARIA_REQUIRED_PART_IDS = [
  "lateral-e",
  "lateral-d",
  "porta-de",
  "porta-dd",
  "porta-te",
  "porta-td",
  "parachoque-d",
  "parachoque-t",
  "paralama-e",
  "paralama-d",
  "capo",
  "porta-malas",
  "tampa-traseira",
  "teto",
  "coluna-a",
  "coluna-b",
  "coluna-c",
  "soleira",
  "painel-traseiro",
] as const;
