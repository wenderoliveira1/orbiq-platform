# Fase 2.1AA — Identidade OCI da imagem

## Objetivo

Dar identidade rastreável à imagem de produção do Orbiq usando metadados OCI públicos e verificáveis.

## Entrega

- identifica a imagem com título e descrição estáveis;
- registra o repositório de origem em `org.opencontainers.image.source`;
- protege os três metadados no contrato estático do Dockerfile;
- inspeciona os labels reais da imagem construída no smoke test;
- não inclui SHA, credenciais, dados de ambiente ou outros valores dinâmicos;
- preserva segurança, lifecycle, orçamento e higiene do container;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1Z (`b2057dcf6530f053c6a96be1fab9cc772a6f698e`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
