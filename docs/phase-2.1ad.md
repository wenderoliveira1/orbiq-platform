# Fase 2.1AD — Contrato temporal do healthcheck

## Objetivo

Garantir que a imagem de produção preserve não apenas o endpoint de prontidão, mas também os limites temporais que determinam quando o container é considerado saudável.

## Entrega

- inspeciona o healthcheck efetivamente gravado na imagem construída;
- exige o comando de prontidão em exec form do Docker;
- fixa intervalo de 30 segundos e timeout de 5 segundos;
- preserva período inicial de 15 segundos para aquecimento;
- exige três tentativas antes de declarar o container unhealthy;
- mantém a comprovação real de transição para o estado `healthy`;
- não altera Dockerfile, aplicação, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AC (`2dd15d04b061459765df8af6aff780d930a27667`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
