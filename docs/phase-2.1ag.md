# Fase 2.1AG — Contrato HTTP da identidade de release

## Objetivo

Impedir que a rota pública de identidade da release passe a expor sessão, credenciais, campos arbitrários ou respostas cacheáveis.

## Entrega

- valida `GET /api/release` no runtime standalone exercitado pelo AutoQA;
- exige status HTTP 200 e conteúdo JSON;
- exige `Cache-Control` com `no-store` e `max-age=0`;
- exige `X-Content-Type-Options: nosniff`;
- bloqueia qualquer `Set-Cookie`;
- limita a resposta aos campos públicos `service`, `version`, `release`, `commit` e `channel`;
- valida formatos seguros para versão, release, commit e canal;
- bloqueia identificadores comuns de credenciais no payload serializado;
- não altera endpoint, aplicação, Dockerfile, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AF (`74360fa81431c64a9f6f2b31b8741fed2613ed99`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
