# Fase 2.1AE — Contrato HTTP de prontidão

## Objetivo

Comprovar que o endpoint público usado para prontidão permanece seguro para consumo operacional e não introduz estado de sessão ou cache indevido.

## Entrega

- valida a resposta real de `/api/ready` no container em execução;
- preserva status HTTP de sucesso e o corpo `orbiq-web / ready`;
- exige conteúdo JSON;
- exige `Cache-Control` com `no-store` e `max-age=0`;
- bloqueia qualquer header `Set-Cookie` na resposta de prontidão;
- diferencia falha do contrato HTTP de indisponibilidade transitória durante o startup;
- não altera endpoint, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AD (`a51e58e14123a5671807819348be61a132dfe752`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
