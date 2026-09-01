# Fase 2.1K — Ações imutáveis e privilégio mínimo no CI

## Objetivo

Impedir que os workflows executem ações GitHub por tags mutáveis e preservar o acesso mínimo necessário ao repositório.

## Entrega

- adiciona uma guarda dedicada para validar todas as referências `uses:`;
- exige SHA completo de 40 caracteres para cada ação externa;
- preserva `permissions: contents: read` nos dois workflows;
- executa a verificação antes da instalação das dependências;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1J (`da4a277a2c63fe9a4bd72123512a7bd88c0b58b2`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
