# Fase 2.1P — Contrato de segurança do container

## Objetivo

Impedir que alterações futuras enfraqueçam o isolamento e o menor privilégio da imagem de produção do Orbiq.

## Entrega

- adiciona uma guarda dedicada para o estágio final do Docker;
- exige execução como usuário não-root `nextjs`;
- preserva propriedade restrita dos arquivos copiados para o runtime;
- mantém `NODE_ENV=production`, health check e comando em formato exec;
- bloqueia retorno ao usuário root e instalação de pacotes no estágio final;
- bloqueia credenciais sensíveis em `ARG` ou `ENV`;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1O (`395934e31d1c3814ca9c1960ab078ea582f57b01`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
