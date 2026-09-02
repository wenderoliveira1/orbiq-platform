# Fase 2.1AN — Neutralidade do agente operacional

## Objetivo

Garantir que sondas, ferramentas de linha de comando e monitores recebam o mesmo contrato público dos endpoints operacionais.

## Entrega

- exercita agentes representando curl, Kubernetes e monitoramento do Orbiq;
- exige HTTP 200 e JSON nos três endpoints;
- compara cada resposta com o payload canônico;
- preserva política `no-store`;
- bloqueia qualquer `Set-Cookie`;
- cobre nove combinações de endpoint e agente;
- não altera endpoints, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AM (`31d92c460ff0b7f1e8197532a522378f869d2363`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
