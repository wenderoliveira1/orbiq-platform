/** Heuristic PT-BR parse of workshop voice transcripts into quote service fields. */

import { matchFunilariaFromTranscript } from "./funilaria-catalog";

export const VOICE_SERVICE_CATEGORIES = [
  "MECÂNICA",
  "SUSPENSÃO",
  "FREIOS",
  "DIREÇÃO",
  "MOTOR",
  "CÂMBIO",
  "ELÉTRICA",
  "ARREFECIMENTO",
  "AR-CONDICIONADO",
  "FUNILARIA",
  "PINTURA",
  "ALINHAMENTO",
  "OUTROS",
] as const;

export type ParsedVoiceService = {
  category: string;
  description: string;
  laborAmount: string;
  needsPart: boolean;
  partDescription: string;
};

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeForMatch(value: string) {
  return stripDiacritics(value).toLocaleLowerCase("pt-BR").trim();
}

const CATEGORY_ALIASES: Array<{ category: string; patterns: string[] }> = [
  { category: "FUNILARIA", patterns: ["funilaria", "lataria", "amassado", "amassar", "desamassar", "bater chapa"] },
  { category: "PINTURA", patterns: ["pintura", "pintar", "repintura"] },
  { category: "MECÂNICA", patterns: ["mecanica", "mecanico"] },
  { category: "SUSPENSÃO", patterns: ["suspensao", "amortecedor", "bandeja"] },
  { category: "FREIOS", patterns: ["freio", "freios", "pastilha", "disco de freio"] },
  { category: "DIREÇÃO", patterns: ["direcao", "caixa de direcao", "terminal de direcao"] },
  { category: "MOTOR", patterns: ["motor", "cabeçote", "cabecote", "junta do cabecote"] },
  { category: "CÂMBIO", patterns: ["cambio", "embreagem", "transmissao"] },
  { category: "ELÉTRICA", patterns: ["eletrica", "eletrico", "bateria", "alternador", "partida"] },
  { category: "ARREFECIMENTO", patterns: ["arrefecimento", "radiador", "agua do motor"] },
  { category: "AR-CONDICIONADO", patterns: ["ar-condicionado", "ar condicionado", "climatizacao"] },
  { category: "ALINHAMENTO", patterns: ["alinhamento e balanceamento", "alinhamento", "balanceamento", "geometria"] },
];

const FUNILARIA_VERB_RE =
  /\b(desamassar|retocar|cortar|soldar|polir|recuperar|alinhar|pintar|trocar|bater chapa|retoque|polimento)\b/;

function detectCategory(normalized: string): string {
  for (const entry of CATEGORY_ALIASES) {
    if (entry.patterns.some((pattern) => normalized.includes(pattern))) {
      return entry.category;
    }
  }
  return "OUTROS";
}

function extractLaborAmount(raw: string): { amount: string; cleaned: string } {
  const moneyPatterns = [
    /m[aã]o\s+de\s+obra(?:\s+(?:de|da|do|em))?\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
    /(?:r\$\s*)(\d+(?:[.,]\d{1,2})?)\s*(?:de\s+)?(?:m[aã]o\s+de\s+obra|mo\b)/i,
    /(?:valor|custa|custo|cobrar|cobran[cç]a)\s*(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
    /(?:r\$\s*)(\d+(?:[.,]\d{1,2})?)/i,
  ];

  for (const pattern of moneyPatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      const amount = match[1].replace(/\./g, "").replace(",", ".");
      const cleaned = raw.replace(match[0], " ").replace(/\s+/g, " ").trim();
      return { amount, cleaned };
    }
  }

  // Trailing number after category words: "pintura 800"
  const trailing = raw.match(/\b(\d{2,6}(?:[.,]\d{1,2})?)\s*$/);
  if (trailing?.[1]) {
    const amount = trailing[1].replace(/\./g, "").replace(",", ".");
    const cleaned = raw.slice(0, trailing.index).trim();
    return { amount, cleaned };
  }

  return { amount: "", cleaned: raw.trim() };
}

function detectNeedsPart(normalized: string): boolean {
  return /\b(peca|peças|pecas|com peca|trocar peca|inclui peca|para-lama|paralama|parachoque|para-choque|capo|porta|retrovisor)\b/.test(
    normalized,
  );
}

function extractPartDescription(raw: string, needsPart: boolean): string {
  if (!needsPart) return "";
  const partMatch = raw.match(/(?:pe[cç]a|peças|pecas)\s*(?:de|:)?\s*(.+)$/i);
  if (partMatch?.[1]) {
    return partMatch[1].trim().toLocaleUpperCase("pt-BR");
  }
  // Common body parts often imply the part itself
  const body = raw.match(
    /\b(para-?lama(?:\s+\w+)?|para-?choque(?:\s+\w+)?|cap[oô]|porta(?:\s+\w+)?|retrovisor(?:\s+\w+)?|farol(?:\s+\w+)?|lanterna(?:\s+\w+)?|painel(?:\s+\w+)?|coluna(?:\s+\w+)?|soleira|tampa traseira)\b/i,
  );
  if (body?.[1]) {
    return body[1].trim().toLocaleUpperCase("pt-BR");
  }
  return "";
}

function buildDescription(cleaned: string, category: string): string {
  let text = cleaned.replace(/\s+/g, " ").trim();
  if (!text) return category === "OUTROS" ? "SERVIÇO POR VOZ" : category;

  // Drop leading filler
  text = text
    .replace(/^(adicionar|incluir|lan[cç]ar|anotar|registrar|servi[cç]o|faz(?:er)?)\s+/i, "")
    .replace(/\b(m[aã]o\s+de\s+obra|com\s+pe[cç]a|pe[cç]a)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return category === "OUTROS" ? "SERVIÇO POR VOZ" : category;
  return text.toLocaleUpperCase("pt-BR");
}

export function parseVoiceTranscript(transcript: string): ParsedVoiceService {
  const raw = transcript.trim();
  const normalized = normalizeForMatch(raw);
  const { amount, cleaned } = extractLaborAmount(raw);

  // Prefer Funilaria guided composition when action + part are recognized.
  // Pintura stays in the same Funilaria flow when a body part is present.
  const funilaria = matchFunilariaFromTranscript(cleaned || raw);
  if (funilaria.description) {
    const explicitPart =
      /\b(peca|pecas|com peca|inclui peca|trocar)\b/.test(normalized) ||
      Boolean(funilaria.action && funilaria.action.id === "trocar");
    return {
      category: "FUNILARIA",
      description: funilaria.description,
      laborAmount: amount,
      needsPart: explicitPart,
      partDescription: explicitPart && funilaria.part ? funilaria.part.phrase : "",
    };
  }

  let category = detectCategory(normalized);
  // Body-shop verbs without a matched part still lean Funilaria (incl. pintar alone)
  if (category === "OUTROS" && FUNILARIA_VERB_RE.test(normalized)) {
    category = "FUNILARIA";
  }
  // "pintura para-lama…" without full match still prefers FUNILARIA over bare PINTURA sibling
  if (category === "PINTURA" && funilaria.part) {
    category = "FUNILARIA";
  }

  const needsPart = detectNeedsPart(normalized) && /\b(peca|pecas|com peca|inclui peca|trocar)\b/.test(normalized);
  const partDescription = extractPartDescription(cleaned, needsPart);
  let description = buildDescription(cleaned, category);

  // Partial funilaria: known verb or part → keep uppercase composition hint
  if (funilaria.action && !funilaria.part) {
    description = funilaria.action.verb;
    if (category === "OUTROS" || category === "PINTURA") category = "FUNILARIA";
  } else if (funilaria.part && !funilaria.action) {
    description = funilaria.part.phrase;
    if (category === "OUTROS" || category === "PINTURA") category = "FUNILARIA";
  }

  return {
    category,
    description,
    laborAmount: amount,
    needsPart,
    partDescription,
  };
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  return recognition;
}
