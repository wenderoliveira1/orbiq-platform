# Fase 2.1AM — Neutralidade de idioma operacional

## Objetivo

Garantir que preferências de idioma do cliente não personalizem, ampliem ou alterem os endpoints operacionais.

## Entrega

- exercita preferências em português, inglês e japonês;
- exige HTTP 200 e JSON nos três endpoints;
- compara cada resposta com o payload canônico sem `Accept-Language`;
- preserva política `no-store`;
- bloqueia qualquer `Set-Cookie`;
- cobre nove combinações de endpoint e idioma;
- não altera endpoints, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AL (`ca168d81592835788a1e8a197d82336ad03368f3`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
