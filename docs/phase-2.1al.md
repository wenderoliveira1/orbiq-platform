# Fase 2.1AL — Representação JSON operacional

## Objetivo

Garantir que negociação de conteúdo não faça os endpoints operacionais retornarem HTML, XML ou uma representação ampliada.

## Entrega

- exercita `Accept: text/html`, `application/xml` e `*/*`;
- exige HTTP 200 e `application/json` nos três endpoints;
- compara cada resposta com o JSON canônico sem header `Accept`;
- preserva política `no-store`;
- bloqueia qualquer `Set-Cookie`;
- cobre nove combinações de endpoint e representação solicitada;
- não altera endpoints, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AK (`4bd94d5ee7181b5f21ca94564e699acb9e81f421`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
