# Fase 2.1J — Consistência da toolchain entre repositório, CI e Docker

## Objetivo

Impedir que Node.js e pnpm sejam atualizados em apenas um ponto do projeto, deixando desenvolvimento local, GitHub Actions e imagem Docker em versões diferentes.

## Entrega

- adiciona `scripts/verify-toolchain-consistency.mjs` como guarda dedicada;
- usa `.node-version` e `packageManager` da raiz como fontes canônicas para Node.js e pnpm;
- verifica `engines.node`, Quality Gate, AutoQA e Dockerfile contra essas versões;
- executa a guarda antes da instalação de dependências nos dois workflows;
- nenhuma migration, dado, RLS, segredo, cache PWA ou configuração de produção é alterado.

## Benefício operacional

Uma atualização parcial de runtime passa a falhar cedo no CI, antes de build, Supabase ou testes E2E. Isso reduz drift silencioso e torna upgrades de toolchain mudanças explícitas e revisáveis.

## Gate

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
