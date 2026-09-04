# Fase 2.1AT — Resiliência da atualização do PWA

## Objetivo

Evoluir a atualização segura do PWA para lidar com falhas transitórias e manter o usuário informado sem recarregar a sessão de forma inesperada.

## Entrega

- bloqueio idempotente de comandos duplicados por service worker aguardando;
- listeners de atualização registrados uma única vez por montagem do componente;
- timeout de 12 segundos para `controllerchange` sem deixar a interface presa;
- falha recuperável com preservação da sessão e botão **Tentar novamente**;
- novo comando de ativação enviado apenas após confirmação explícita do usuário;
- nenhum reload automático antes da troca efetiva do controller;
- verificações de E2E em Chromium para sucesso, timeout e retry;
- política de cache público preservada: APIs e dados autenticados continuam fora do Cache Storage.

## Critérios de aceite

1. Um único `ORBIQ_SKIP_WAITING` por tentativa de atualização.
2. Nenhum reload automático antes da troca efetiva do controller.
3. Timeout de atualização retorna a interface para um estado acionável.
4. Nova tentativa não duplica listeners nem comandos.
5. Quality Gate e AutoQA verdes no mesmo HEAD antes do merge.

## Validação

A cobertura dedicada valida o comando único, a ausência de reload prematuro, a recuperação após timeout e a preservação da política de não cachear APIs.

## Segurança

Sem migrations, sem alterações em dados, sem `service_role`, sem deploy externo e sem cache de respostas autenticadas.