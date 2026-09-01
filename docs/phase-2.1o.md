# Fase 2.1O — Higiene dos logs do CI

## Objetivo

Reduzir o risco de credenciais, variáveis de ambiente ou saídas sensíveis aparecerem nos logs do Quality Gate e do AutoQA.

## Entrega

- adiciona uma guarda dedicada para higiene dos logs;
- bloqueia rastreamento de shell com `set -x` ou `xtrace`;
- bloqueia dumps completos com `env` e `printenv`;
- bloqueia interpolação ou serialização direta do contexto `secrets`;
- impede a impressão direta do ambiente local do Supabase;
- preserva o mascaramento das chaves públicas usadas pelo AutoQA;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1N (`2c47784739ca8a4952d93c18bbe35d646dfd3f7a`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
