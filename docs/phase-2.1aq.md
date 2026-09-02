# Fase 2.1AQ — PWA offline em runtime

## Objetivo

Sair da validação estática do PWA e comprovar no navegador que o service worker entrega o shell offline sem armazenar dados de API.

## Entrega

- registra o service worker no runtime de produção;
- confirma o cache público versionado;
- confirma que `/offline` está disponível no cache;
- confirma que nenhuma entrada `/api/*` é colocada no cache público;
- simula perda de rede no Chromium e verifica o fallback para a tela offline;
- confirma que os dados da oficina não aparecem como parte do shell cacheado.

## Segurança

Nenhuma migration, dado, RLS, segredo ou configuração de produção foi alterada. A fase somente amplia o AutoQA para validar o comportamento real do PWA no navegador.

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
