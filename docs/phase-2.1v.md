# Fase 2.1V — Lifecycle seguro do container

## Objetivo

Validar que o container de produção do Orbiq não apenas inicia e fica pronto, mas também encerra de forma previsível ao receber o sinal normal de parada.

## Entrega

- mantém o smoke test real e todas as restrições de runtime da Fase 2.1U;
- envia `SIGTERM` por meio de `docker stop` com janela de 10 segundos;
- exige estado final `exited`;
- aceita código `0` ou `143`, representando encerramento voluntário ou término normal por `SIGTERM`;
- bloqueia OOM, timeout e códigos de saída inesperados;
- limita a duração total observada da parada a 12 segundos;
- preserva a limpeza do container e da imagem temporária;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1U (`950f35c2f9558dc3c9e47543bca7659601a509fd`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
