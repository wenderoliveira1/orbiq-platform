# Fase 2.1AH — Métodos dos endpoints operacionais

## Objetivo

Garantir que os endpoints públicos de health, readiness e identidade de release permaneçam estritamente de leitura.

## Entrega

- exercita `POST`, `PUT`, `PATCH` e `DELETE` em cada endpoint operacional;
- exige resposta HTTP 405 para todos os métodos mutáveis;
- bloqueia criação acidental de cookies nas respostas de rejeição;
- preserva `GET` e a separação entre vitalidade, prontidão e identidade de release;
- adiciona 12 cenários de regressão ao AutoQA;
- não altera endpoints, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AG (`0a8a2cc09da68acd0a15fa59d41ff51f97bb4a09`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
