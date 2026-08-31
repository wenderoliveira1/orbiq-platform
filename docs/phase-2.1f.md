# Fase 2.1F — Telemetria externa desativada no CI

## Objetivo

Evitar que os builds executados pelos gates do Orbiq enviem telemetria anônima do Next.js durante validações de CI.

## Entrega

- define `NEXT_TELEMETRY_DISABLED: "1"` no Quality Gate;
- define `NEXT_TELEMETRY_DISABLED: "1"` no AutoQA;
- mantém `contents: read`, runner fixado e Actions pinadas por SHA;
- adiciona AutoQA dedicado para impedir regressão desse contrato.

## Escopo de risco

Nenhuma migration, dado, RLS, cache PWA, segredo, dependência, configuração de produção ou comportamento funcional do aplicativo é alterado.

## Processo

A fase foi iniciada sobre o HEAD validado da 2.1E, que ainda aguarda aprovação e merge. A PR desta fase deve permanecer não-draft e não pode ser promovida antes da ordem de aprovação das fases anteriores, além de Quality Gate e AutoQA verdes no mesmo HEAD.
