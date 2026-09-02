# Fase 2.1AF — Contrato HTTP de vitalidade

## Objetivo

Comprovar separadamente que o endpoint de vitalidade do Orbiq responde como uma sonda pública, sem cache ou estado de sessão.

## Entrega

- consulta `/api/health` após a aplicação estar pronta;
- exige status HTTP de sucesso e o corpo `orbiq-web / healthy`;
- exige conteúdo JSON;
- exige `Cache-Control` com `no-store` e `max-age=0`;
- bloqueia qualquer header `Set-Cookie`;
- mantém separadas as responsabilidades de vitalidade e prontidão;
- não altera endpoints, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AE (`240ea907f351409b837ee177040dd20a9188e937`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
