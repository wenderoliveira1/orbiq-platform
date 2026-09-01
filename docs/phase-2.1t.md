# Fase 2.1T — Smoke test do container de produção

## Objetivo

Validar no CI que o Dockerfile protegido pelas fases anteriores realmente constrói uma imagem executável e que o servidor standalone fica pronto com o contrato esperado.

## Entrega

- constrói a imagem de produção nos dois workflows;
- usa somente configuração pública sintética, sem credenciais locais ou externas;
- confirma na imagem o usuário não-root `nextjs`;
- confirma o comando de inicialização `node apps/web/server.js`;
- inicia o container com isolamento e nome efêmero;
- consulta `/api/ready` até obter o contrato `orbiq-web/ready`;
- remove o container e a imagem temporários ao final;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1S (`7304e8b937c9b3896a6138336e660687e2c94ad8`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
