# Fase 2.1AO — Proveniência da release

## Objetivo

Garantir que a identidade pública de uma release continue rastreável até o commit que produziu o artefato, sem expor credenciais privilegiadas.

## Entrega

- guarda dedicada para o contrato de proveniência da release;
- `ORBIQ_RELEASE_SHA`, `VERCEL_GIT_COMMIT_SHA` e `GITHUB_SHA` permanecem na cadeia de identificação;
- identificadores de release e commit mantêm formatos seguros e limitados;
- `/api/release` continua dinâmico, HTTP 200, `no-store` e com `nosniff`;
- o endpoint expõe somente os metadados operacionais previstos;
- o `release:drill` continua sendo a validação canônica que vincula release, commit e canal local;
- a guarda é executada tanto no Quality Gate quanto no AutoQA.

## Segurança

A fase não altera produção, banco, migrations, dados, RLS, segredos ou cache PWA. O objetivo é reduzir o risco de um artefato ser promovido sem uma identidade operacional verificável ou de metadados públicos incorporarem credenciais privilegiadas.

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
