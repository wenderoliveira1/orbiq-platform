# Fase 2.1W — Healthcheck nativo do container

## Objetivo

Comprovar que o healthcheck declarado no Dockerfile alcança o estado `healthy` usado por Docker e orquestradores, não apenas que a rota responde externamente.

## Entrega

- preserva o build, isolamento, readiness e shutdown testados nas fases anteriores;
- consulta o estado nativo de saúde do container;
- exige transição para `healthy` dentro de 75 segundos;
- falha imediatamente se o estado se tornar `unhealthy`;
- não imprime logs internos nem configuração pública durante a verificação;
- mantém o encerramento normal por `SIGTERM` após a validação;
- executa integralmente no Quality Gate e no AutoQA;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1V (`9dcb09e601080954e413dcc820d68e24fdfc9748`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
