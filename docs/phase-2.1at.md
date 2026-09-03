# Fase 2.1AT — Resiliência da atualização do PWA

## Objetivo

Evoluir a atualização segura do PWA para lidar com falhas transitórias e manter o usuário informado sem recarregar a sessão de forma inesperada.

## Escopo

- impedir comandos duplicados quando o usuário toca várias vezes em **Atualizar agora**;
- tratar `controllerchange` que não chega no tempo esperado sem deixar a interface presa em estado de atualização;
- exibir mensagem de falha recuperável e permitir nova tentativa sem perder o contexto atual;
- manter a política de não cachear APIs nem dados autenticados;
- cobrir a transição com testes E2E em Chromium para sucesso, timeout e repetição controlada;
- registrar no diagnóstico seguro apenas o estado técnico necessário, sem dados da oficina.

## Critérios de aceite

1. Um único `ORBIQ_SKIP_WAITING` por tentativa de atualização.
2. Nenhum reload automático antes da troca efetiva do controller.
3. Timeout de atualização retorna a interface para um estado acionável.
4. Nova tentativa não duplica listeners nem comandos.
5. Quality Gate e AutoQA verdes no mesmo HEAD antes do merge.

## Segurança

Sem migrations, sem alterações em dados, sem `service_role`, sem deploy externo e sem cache de respostas autenticadas.