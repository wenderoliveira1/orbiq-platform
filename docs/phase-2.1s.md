# Fase 2.1S — Configuração pública do container

## Objetivo

Impedir que variáveis não aprovadas, credenciais ou valores rígidos sejam introduzidos no contrato de build e runtime da imagem do Orbiq.

## Entrega

- cria uma lista explícita das três variáveis públicas permitidas no container;
- exige o mesmo contrato nos estágios builder e runner;
- mantém a URL local segura como único valor padrão;
- bloqueia novos argumentos e variáveis de ambiente sem revisão;
- impede o uso de service role, segredo ou chave anon no namespace público;
- detecta valores com formato de credencial gravados diretamente no Dockerfile;
- executa a verificação no Quality Gate e no AutoQA;
- não altera migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1R (`6fed0ea648d2438c3ebd32bd62560e8175603c0f`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
