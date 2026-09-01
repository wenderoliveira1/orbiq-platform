# Fase 2.1U — Runtime endurecido do container

## Objetivo

Comprovar que o servidor standalone do Orbiq continua funcional quando executado com restrições equivalentes a um runtime de produção endurecido.

## Entrega

- executa o container com filesystem raiz somente leitura;
- disponibiliza apenas um `/tmp` efêmero, sem execução e sem elevação;
- remove todas as capabilities Linux;
- ativa `no-new-privileges`;
- limita o runtime a 512 MiB, 1 CPU e 128 processos;
- inspeciona o container para confirmar que cada restrição foi aplicada;
- mantém a validação real de `/api/ready` nos dois workflows;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1T (`a2f14602dea912c98fd1ffcd53d06bc3fefe7f7b`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
