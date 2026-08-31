# Fase 2.1D — Checkout de CI sem credenciais persistentes

## Objetivo

Evitar que o token temporário usado pelo `actions/checkout` permaneça gravado no Git config durante os jobs de Quality Gate e AutoQA.

## Decisão

Os workflows do Orbiq usam apenas `contents: read` e não executam push, tag ou alteração remota. Portanto, o checkout passa a usar explicitamente `persist-credentials: false` nos dois gates.

## Garantias

- actions continuam fixadas por SHA imutável;
- permissões permanecem `contents: read`;
- nenhum dado, migration, cache PWA ou configuração de produção é alterado;
- AutoQA dedicado impede regressão para `persist-credentials: true`.
