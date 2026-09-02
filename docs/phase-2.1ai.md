# Fase 2.1AI — Orçamento dos payloads operacionais

## Objetivo

Impedir que os endpoints públicos de operação cresçam silenciosamente e passem a expor dados além do necessário.

## Entrega

- limita cada resposta de health, readiness e release a 512 bytes;
- exige JSON em formato de objeto, nunca coleção;
- preserva exatamente dois campos em health e readiness;
- preserva exatamente cinco campos públicos na identidade de release;
- adiciona três cenários de regressão ao AutoQA;
- mantém contratos HTTP, métodos somente leitura e ausência de sessão;
- não altera endpoints, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AH (`f02f6c41cb0a9819e24321071ef3b077ece1d94c`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
