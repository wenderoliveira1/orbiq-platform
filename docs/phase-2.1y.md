# Fase 2.1Y — Higiene do filesystem da imagem

## Objetivo

Comprovar no container em execução que arquivos locais, relatórios e estados temporários não chegaram ao runtime final do Orbiq.

## Entrega

- inspeciona somente nomes e caminhos conhecidos, sem ler ou imprimir conteúdo;
- bloqueia arquivos `.env` e variantes nas raízes do runtime;
- bloqueia metadados Git, workflows e estado local do AutoQA;
- bloqueia relatórios Playwright, resultados de teste e cobertura;
- bloqueia temporários e branches locais do Supabase;
- executa a inspeção como o usuário não-root da própria imagem;
- preserva orçamento, isolamento, healthcheck nativo e shutdown seguro;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1X (`1074100952b9b08b402933527961380054e97cab`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
