# Fase 2.1N — Privacidade dos artefatos do AutoQA

## Objetivo

Reduzir o risco de um ajuste futuro no workflow enviar arquivos de ambiente, estado autenticado ou diretórios amplos para os artefatos do CI.

## Entrega

- torna explícito que arquivos ocultos não entram no upload do AutoQA;
- impede sobrescrita de artefatos existentes;
- mantém nome único por execução e retenção máxima de 14 dias;
- limita o upload aos diretórios `playwright-report` e `test-results`;
- adiciona guarda dedicada contra `.env`, `$GITHUB_ENV`, `node_modules`, `.next`, estado de autenticação e temporários do Supabase;
- executa a guarda antes da instalação de dependências nos dois workflows;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1M (`56064aa8dcf5b378e82714418a74eff199a83067`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
