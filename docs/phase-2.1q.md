# Fase 2.1Q — Privacidade do contexto Docker

## Objetivo

Impedir que segredos, estados locais e artefatos de desenvolvimento entrem no contexto enviado ao build da imagem do Orbiq.

## Entrega

- amplia o contrato do `.dockerignore` para ambientes aninhados, estado do AutoQA, cobertura, logs e temporários locais do Supabase;
- preserva a exclusão de metadados Git, workflows, dependências, builds e relatórios de teste;
- bloqueia regras de negação que reabram caminhos protegidos;
- vincula a guarda ao `COPY . .` do estágio de build;
- executa a verificação no Quality Gate e no AutoQA;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1P (`33a06d5dd21624d6cbb5e13a0cf50f4ea60d0bab`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
