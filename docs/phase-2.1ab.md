# Fase 2.1AB — Privacidade dos metadados da imagem

## Objetivo

Impedir que identificadores de credenciais sensíveis sejam persistidos na configuração ou no histórico da imagem de produção do Orbiq.

## Entrega

- inspeciona os nomes das variáveis gravadas em `.Config.Env`;
- inspeciona as chaves dos labels OCI da imagem;
- verifica o histórico completo das camadas sem imprimi-lo nos logs;
- bloqueia identificadores de service role, anon key, banco, senhas, chaves privadas, tokens e client/API secrets;
- em caso de falha, emite apenas uma mensagem genérica, sem refletir valores;
- preserva as configurações públicas aprovadas e a chave sintética usada no CI;
- não altera Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AA (`bed30bfa6a55de07320b0b2ae0eab3ead6cedb5b`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
