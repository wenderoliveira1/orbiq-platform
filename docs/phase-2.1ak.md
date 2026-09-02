# Fase 2.1AK — Neutralidade de query operacional

## Objetivo

Impedir que parâmetros de diagnóstico ou formato ampliem silenciosamente as respostas públicas dos endpoints operacionais.

## Entrega

- compara respostas com e sem parâmetros `debug`, `verbose` e `format`;
- exige igualdade integral do JSON nos três endpoints operacionais;
- preserva status HTTP 200;
- preserva `Cache-Control: no-store, max-age=0`;
- bloqueia qualquer `Set-Cookie`;
- adiciona três cenários de regressão ao AutoQA;
- não altera endpoints, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AJ (`992a28716de5d6aa6ae716584392846a341de203`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
