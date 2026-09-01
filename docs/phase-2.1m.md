# Fase 2.1M — Contrato de gatilhos do CI

## Objetivo

Impedir que mudanças acidentais ampliem quando os workflows são executados ou introduzam gatilhos com superfície de risco maior.

## Entrega

- adiciona uma guarda dedicada para os gatilhos do Quality Gate e do AutoQA;
- preserva o Quality Gate em pushes e PRs direcionados à `main`;
- preserva o AutoQA em branches `qa/**`, PRs para `main` e execução manual;
- bloqueia `pull_request_target`, `repository_dispatch` e agendamentos;
- preserva grupos de concorrência isolados por branch;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1L (`221e851037c3d85f68d2f12e4a4d5343229542b2`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
