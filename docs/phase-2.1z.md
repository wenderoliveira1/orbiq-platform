# Fase 2.1Z — Sinal explícito de parada do container

## Objetivo

Tornar explícito e verificável o sinal usado pelo runtime para encerrar o container de produção do Orbiq.

## Entrega

- declara `STOPSIGNAL SIGTERM` no estágio final da imagem;
- protege estaticamente a presença e a posição do contrato antes do comando de inicialização;
- inspeciona a imagem construída e exige `.Config.StopSignal = SIGTERM`;
- mantém o teste real de encerramento dentro do orçamento de 12 segundos;
- preserva usuário não-root, filesystem somente leitura, limites de recursos, healthcheck e higiene da imagem;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1Y (`9a7d78774b0ec4a402ddb44208e54c9fa0ca0234`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
