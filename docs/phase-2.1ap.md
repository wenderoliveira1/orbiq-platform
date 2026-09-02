# Fase 2.1AP — Contrato PWA offline

## Objetivo

Proteger a experiência instalável do Orbiq contra regressões que possam cachear dados privados, quebrar a atualização do service worker ou retirar o fallback offline.

## Entrega

- guarda dedicada para o manifesto PWA e o service worker;
- `start_url`, `scope`, identidade, idioma, ícones e atalhos críticos permanecem estáveis;
- shell público usa cache versionado e remove versões antigas do Orbiq;
- pré-cache usa `credentials: omit` e `cache: reload`;
- service worker só intercepta GET e a própria origem;
- somente caminhos públicos explícitos podem ser atendidos pelo cache;
- endpoints `/api/*` não entram no shell cacheável;
- navegação offline mantém fallback para `/offline`;
- atualização explícita via `skipWaiting` e `clients.claim` permanece protegida;
- guarda executada tanto no Quality Gate quanto no AutoQA.

## Segurança

A fase não altera banco, migrations, dados, RLS, segredos ou produção. O foco é impedir vazamento acidental de dados autenticados pelo cache do PWA e preservar uma recuperação offline previsível.

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
