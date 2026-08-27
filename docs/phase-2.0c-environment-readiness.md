# Fase 2.0C — Contrato de ambiente e prontidão operacional

## Objetivo

Transformar falhas tardias de configuração em falhas antecipadas, objetivas e
seguras. O mesmo contrato poderá ser consumido pelo Web, pelo futuro aplicativo
mobile e por ferramentas de CI sem duplicar regras críticas.

## Contrato público

O pacote `@orbiq/config` valida:

- URL pública do Orbiq;
- URL pública do Supabase;
- chave publicável do Supabase;
- compatibilidade com a chave `anon` JWT legada do ambiente local;
- proibição de `sb_secret_...` e `service_role` no cliente.

As mensagens de erro citam apenas o nome da variável e a regra violada. Valores,
tokens e credenciais nunca são enviados aos logs.

## Ciclo de validação

1. `pnpm dev` injeta os valores locais e valida antes de iniciar o Next.js;
2. o Quality Gate valida o mesmo contrato antes do build;
3. `instrumentation.ts` repete a validação ao iniciar cada servidor;
4. `pnpm start:standalone` falha antes do processo filho se o ambiente estiver
   incompleto;
5. `GET /api/ready` permite que um orquestrador confirme a prontidão sem
   receber nenhuma configuração.

`GET /api/health` continua sendo liveness: ele comprova que o processo está
ativo. O health check do contêiner usa `/api/ready`, pois configuração válida é
obrigatória para receber tráfego.

## Build por ambiente

O Next.js incorpora valores `NEXT_PUBLIC_*` no bundle. Por isso, Preview,
Staging e Production devem gerar artefatos distintos e nunca promover um bundle
construído com endpoints de outro ambiente.

HTTP é aceito para o loopback e o desenvolvimento local. Produção deve usar
HTTPS para o aplicativo e para o Supabase.

## Supabase e segurança

O Orbiq permanece em Node.js 22, atendendo ao runtime suportado pelos clientes
Supabase. As migrations continuam concedendo acesso ao Data API explicitamente
e protegendo todas as tabelas expostas com RLS; a nova política do Supabase de
não expor tabelas automaticamente não altera esse modelo.

## Diagnóstico sem serviço pago

Erros não tratados do servidor geram um evento JSON mínimo com tipo de rota,
nome do erro e digest técnico. Caminho real da requisição, cabeçalhos, mensagem,
stack e dados do usuário não são registrados. Isso prepara integração futura
com observabilidade sem contratar ou criar recurso externo nesta fase.
