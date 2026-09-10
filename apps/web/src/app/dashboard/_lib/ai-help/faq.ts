export type AiHelpFaqEntry = {
  id: string;
  keywords: string[];
  question: string;
  answer: string;
};

/**
 * FAQ curada do Orbiq (PT-BR). Conteúdo operacional para a equipe da oficina.
 * Nunca inclui custo de compra, lucro, margem numérica, service_role ou segredos.
 */
export const ORBIQ_AI_HELP_FAQ: readonly AiHelpFaqEntry[] = [
  {
    id: "novo-orcamento",
    keywords: [
      "novo orçamento",
      "criar orçamento",
      "como orçar",
      "começar orçamento",
      "atendimento",
    ],
    question: "Como criar um novo orçamento?",
    answer:
      "No menu, abra **Novo orçamento**. Informe o telefone do cliente para localizar o cadastro, confira veículo/placa, escolha os serviços (catálogo, Funilaria guiada ou voz) e as peças necessárias. Revise as linhas e salve. O protocolo ORB aparece na lista de orçamentos.",
  },
  {
    id: "cotacao-pecas",
    keywords: [
      "cotação",
      "cotar peças",
      "fornecedor",
      "pedido de cotação",
      "peças",
    ],
    question: "Como fazer cotação de peças com fornecedores?",
    answer:
      "Com o orçamento criado, vá em **Cotações**, abra o pedido e envie aos fornecedores. Compare as respostas na tela de respostas e escolha o melhor conjunto. Valores de compra ficam só no fluxo interno da oficina — nunca na folha do cliente.",
  },
  {
    id: "folha-cliente",
    keywords: [
      "folha do cliente",
      "imprimir cliente",
      "orçamento cliente",
      "link público",
      "compartilhar",
    ],
    question: "Como mostrar o orçamento ao cliente sem dados internos?",
    answer:
      "Use a visão **Cliente** ou o link público do comercial. Essa folha mostra peças, mão de obra e totais de venda. Custo de compra e indicadores internos não aparecem para o cliente. Prefira sempre essa versão ao imprimir para o cliente.",
  },
  {
    id: "voz-funilaria",
    keywords: [
      "voz",
      "microfone",
      "funilaria",
      "ditado",
      "falar serviços",
    ],
    question: "Como usar voz ou Funilaria no orçamento?",
    answer:
      "Em **Novo orçamento**, use o atalho de **voz** para ditar serviços ou abra o seletor guiado de **Funilaria**. Confirme as linhas sugeridas antes de salvar. Funciona melhor em Chrome/Edge com permissão de microfone.",
  },
  {
    id: "buscar-orcamentos",
    keywords: [
      "buscar orçamento",
      "filtrar",
      "placa",
      "orb",
      "rascunho",
      "lista",
    ],
    question: "Como achar um orçamento na lista?",
    answer:
      "Em **Orçamentos**, use a busca por cliente, placa (com ou sem hífen) ou protocolo ORB. Filtre por status, inclusive **Rascunho**. Os cartões de métricas no topo também abrem filtros rápidos.",
  },
  {
    id: "comercial",
    keywords: [
      "comercial",
      "aprovar",
      "preço de venda",
      "desconto",
      "fechar orçamento",
    ],
    question: "Como fechar o lado comercial do orçamento?",
    answer:
      "Em **Comercial**, abra o orçamento, revise peças e mão de obra, ajuste preços de venda quando preciso e avance o status (aguardando cliente, aprovado etc.). Use a folha do cliente para apresentação; mantenha números internos só na visão da equipe.",
  },
  {
    id: "equipe",
    keywords: ["equipe", "convite", "convidar", "permissão", "função"],
    question: "Como convidar alguém da equipe?",
    answer:
      "Em **Equipe**, gere um convite com a função adequada (admin, atendente etc.). Envie o link; a pessoa cria/entra na conta e aceita o convite. Permissões controlam o que cada um vê no menu.",
  },
  {
    id: "trocar-oficina",
    keywords: [
      "trocar oficina",
      "mudar organização",
      "outra oficina",
      "rede",
    ],
    question: "Como trocar de oficina?",
    answer:
      "No seletor de oficina da barra lateral (ou no menu mobile), escolha a oficina desejada. A sessão continua protegida; os dados exibidos passam a ser só da oficina selecionada.",
  },
  {
    id: "tema",
    keywords: ["tema", "escuro", "claro", "dark", "modo"],
    question: "Como mudar o tema claro/escuro?",
    answer:
      "No rodapé da barra lateral (ou no menu mobile), use o botão de tema. A preferência fica salva no navegador e vale para o painel da oficina.",
  },
  {
    id: "compras",
    keywords: ["compras", "pedido de compra", "ordem de compra"],
    question: "Como acompanhar compras?",
    answer:
      "Em **Compras**, abra o pedido gerado a partir das cotações premiadas. Acompanhe itens e status internamente. Esses valores de aquisição não devem ser compartilhados na folha do cliente.",
  },
  {
    id: "execucao",
    keywords: ["execução", "os", "ordem de serviço", "oficina"],
    question: "Como acompanhar a execução na oficina?",
    answer:
      "Depois da aprovação comercial, use **Execução** para abrir a ordem de serviço e marcar o andamento dos serviços. É a visão operacional da oficina, separada da apresentação ao cliente.",
  },
  {
    id: "suporte",
    keywords: ["suporte", "erro", "problema", "ajuda técnica"],
    question: "Onde pedir suporte técnico?",
    answer:
      "Em **Suporte técnico** (menu Administração/diagnósticos) você encontra informações de ambiente para o time Orbiq. Para dúvidas de uso do dia a dia, continue por este assistente de ajuda.",
  },
];

function compact(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAiHelpQuestion(question: string): string {
  return compact(question).slice(0, 500);
}

export function scoreFaqEntry(
  questionNormalized: string,
  entry: AiHelpFaqEntry,
): number {
  const haystack = compact(
    [entry.question, entry.answer, ...entry.keywords].join(" "),
  );
  if (!questionNormalized || !haystack) {
    return 0;
  }

  let score = 0;
  const tokens = questionNormalized.split(" ").filter((token) => token.length > 2);

  for (const keyword of entry.keywords) {
    const needle = compact(keyword);
    if (needle && questionNormalized.includes(needle)) {
      score += 8;
    }
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 2;
    }
  }

  if (haystack.includes(questionNormalized)) {
    score += 12;
  }

  return score;
}

export function findBestFaqAnswer(question: string): {
  entry: AiHelpFaqEntry;
  score: number;
} | null {
  const normalized = normalizeAiHelpQuestion(question);
  let best: { entry: AiHelpFaqEntry; score: number } | null = null;

  for (const entry of ORBIQ_AI_HELP_FAQ) {
    const score = scoreFaqEntry(normalized, entry);
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  if (!best || best.score < 6) {
    return null;
  }

  return best;
}

export function offlineFaqFallbackAnswer(question: string): string {
  const match = findBestFaqAnswer(question);
  if (match) {
    return match.entry.answer;
  }

  const suggestions = ORBIQ_AI_HELP_FAQ.slice(0, 5)
    .map((entry) => `• ${entry.question}`)
    .join("\n");

  return [
    "Ainda não tenho uma resposta precisa para isso no modo offline.",
    "Posso ajudar com temas como:",
    suggestions,
    "",
    "Reformule com palavras como “orçamento”, “cotação”, “cliente”, “equipe” ou “execução”. Com a chave OPENAI_API_KEY no servidor, o assistente também consulta um modelo para perguntas novas.",
  ].join("\n");
}
