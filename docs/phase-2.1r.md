# Fase 2.1R — Build Docker reproduzível

## Objetivo

Impedir que alterações futuras tornem o build da imagem do Orbiq dependente de versões flutuantes, resolução não congelada ou estágios fora de ordem.

## Entrega

- adiciona uma guarda dedicada para a estrutura multiestágio do Dockerfile;
- preserva Node.js 22.23.2, pnpm 11.22.0 e frontend Dockerfile 1.7;
- exige instalação única de dependências com `--frozen-lockfile`;
- mantém a cópia seletiva dos manifests antes da instalação;
- garante que o builder reutilize as dependências e gere o pacote standalone;
- bloqueia instalação de dependências no estágio final e imagem `latest`;
- executa a verificação no Quality Gate e no AutoQA;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1Q (`2d80e301694fb0a287f79cfc6fadb1b38300e0ee`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
