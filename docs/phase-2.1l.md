# Fase 2.1L — Limites de recursos do CI

## Objetivo

Impedir execuções sem limites e retenção excessiva de artefatos, preservando previsibilidade operacional no Quality Gate e no AutoQA.

## Entrega

- adiciona uma guarda dedicada para limites de execução;
- exige `cancel-in-progress: true` nos dois workflows;
- preserva o runner em `ubuntu-24.04`;
- limita o Quality Gate a 40 minutos e o AutoQA a 45 minutos;
- limita relatórios do AutoQA a no máximo 14 dias;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1K (`b02626943dd7ca6b5602ebe24d671bbfca234628`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
