# Fase 2.1I — Contrato do Playwright no AutoQA

## Objetivo

Evitar drift silencioso do runner E2E usado pelo AutoQA e impedir que a preparação do CI altere o manifesto ou lockfile do repositório.

## Entrega

- mantém o Playwright do AutoQA fixado em `1.55.0`;
- instala o runner de forma efêmera com `--no-save`, sem persistir mudança de dependência no repositório;
- verifica explicitamente `pnpm exec playwright --version` antes de instalar o Chromium e executar os testes;
- preserva Node.js `22.23.2`, pnpm `11.22.0` e Supabase CLI `2.115.0` já protegidos pelas fases anteriores;
- nenhuma migration, dado, RLS, segredo, cache PWA ou configuração de produção é alterado.

## Benefício operacional

O AutoQA passa a falhar cedo caso o runner E2E efetivamente executado seja diferente da versão aprovada, e sua preparação deixa de depender de uma mutação persistente do workspace.

## Gate

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
