# Fase 2.1AJ — Sondas HEAD operacionais

## Objetivo

Garantir que monitores possam consultar os endpoints operacionais com `HEAD`, sem transferir payload nem criar estado de sessão.

## Entrega

- exercita `HEAD` em health, readiness e identidade de release;
- exige status HTTP 200 nos três endpoints;
- exige corpo vazio para reduzir transferência e processamento;
- preserva `Cache-Control: no-store, max-age=0`;
- bloqueia qualquer `Set-Cookie`;
- complementa os contratos de GET e a rejeição dos métodos mutáveis;
- não altera endpoints, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AI (`990fc715706d24eacc3b565749bc22cb7d33ee69`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
