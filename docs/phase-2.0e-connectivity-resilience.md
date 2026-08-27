# Fase 2.0E — Resiliência de conectividade

## Objetivo

Tornar o Orbiq previsível em redes móveis instáveis sem transformar o navegador
em uma cópia insegura do banco. O aplicativo informa a perda de conexão e uma
recarga offline recebe uma tela útil, em vez do erro genérico do navegador.

## Estratégia de cache

O service worker utiliza uma allowlist fechada:

- `/offline`;
- `/icon.svg`;
- `/manifest.webmanifest`.

Navegações continuam network-first e suas respostas nunca são gravadas. Métodos
diferentes de GET, origens externas, APIs, Server Actions e chamadas Supabase
não são interceptados. Assim, dashboard, clientes, veículos, orçamentos,
exportações e tokens não entram no Cache Storage.

## Ciclo de vida

- instalação atômica: o worker só ativa quando todo o shell público está salvo;
- versão explícita de cache e remoção apenas de caches antigos do próprio Orbiq;
- controle imediato das páginas abertas, sem dependência externa;
- script servido com `no-store`, MIME JavaScript, CSP restrita e escopo raiz;
- registro somente no build de produção; desenvolvimento remove o registro para
  preservar o HMR.

## Experiência

Uma interface aberta exibe um aviso não bloqueante quando o dispositivo perde a
rede. Em uma navegação ou recarga completa offline, a tela explica o estado,
declara a política de proteção de dados e permite tentar novamente após a
reconexão. Safe areas, modo escuro, foco visível e impressão foram considerados.

## Decisão sobre Next.js experimental

O Next.js 16.3.3 oferece `experimental.useOffline` para reter e repetir
navegações e Server Actions. A fase não habilita essa opção porque ainda é
experimental e mudaria a semântica das mutações. A base atual usa somente APIs
Web estáveis; a adoção futura dependerá de maturidade e testes específicos de
idempotência.

## Evidência automática

O AutoQA valida os cabeçalhos do worker, seu controle efetivo da página, a lista
exata do Cache Storage, o aviso de rede, o fallback em recarga offline e a
recuperação da sessão ao reconectar.
