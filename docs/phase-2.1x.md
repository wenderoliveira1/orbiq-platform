# Fase 2.1X — Orçamento de tamanho da imagem

## Objetivo

Impedir que dependências ou artefatos acidentais aumentem silenciosamente a imagem de produção do Orbiq.

## Entrega

- mede a imagem efetivamente construída no smoke test;
- exige tamanho válido e maior que zero;
- define orçamento máximo de 400 MiB;
- informa somente o tamanho agregado, sem listar arquivos ou metadados sensíveis;
- falha antes de iniciar o container se o orçamento for ultrapassado;
- preserva isolamento, healthcheck nativo e shutdown seguro;
- executa integralmente no Quality Gate e no AutoQA;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1W (`653d249b9ef581e07ddec8526c717551c35ae192`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
