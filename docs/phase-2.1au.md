# Fase 2.1AU — Observabilidade segura da atualização do PWA

## Objetivo

Fechar o ciclo de atualização do PWA com uma especificação operacional curta, verificável e segura. A atualização deve ser observável pelo usuário sem registrar dados de negócio, sem depender de sessão autenticada e sem transformar telemetria em mecanismo de reload automático.

## Contrato

- eventos permitidos: `update_detected`, `update_deferred`, `update_requested`, `update_activated`, `update_failed`;
- payload mínimo: `event`, `source`, `timestamp` e `attempt`;
- `source` limitado a `startup`, `visibility`, `online`, `interval` e `manual`;
- `attempt` inteiro entre `0` e `3`;
- nunca incluir e-mail, organização, cliente, veículo, placa, orçamento, URL interna, token, cookie ou corpo de resposta;
- falha transitória deve permanecer recuperável, sem bloquear a interface e sem recarregar a página antes de `controllerchange`;
- eventos são locais por padrão; qualquer exportação futura exige consentimento e política própria.

## Critérios de aceite

1. A UI continua utilizável quando a atualização falha ou expira.
2. Repetições são limitadas a três tentativas por ciclo de atualização.
3. `Atualizar agora` só envia `ORBIQ_SKIP_WAITING` para o worker aguardando.
4. Nenhum evento de atualização grava dados autenticados em Cache Storage.
5. O diagnóstico seguro pode informar contagem/estado sem revelar identidade operacional.

## Segurança e operação

Esta fase não altera banco, migrations, RLS, segredos, dados de produção ou deploy externo. O documento serve como contrato para a próxima implementação incremental e para revisão de incidentes de atualização.