# Fase 2.0B — Paridade local-produção e portabilidade

## Objetivo

Continuar o Orbiq localmente sem acoplar a aplicação à Vercel. O mesmo build
deve funcionar hoje na máquina de desenvolvimento e, futuramente, em qualquer
hospedagem comercial capaz de executar um contêiner Node.js.

## Fluxo local de desenvolvimento

```bash
pnpm install --frozen-lockfile
pnpm supabase:start
pnpm dev
```

O desenvolvimento mantém `next dev`, HMR e o Supabase local. Antes de iniciar
o Web, `pnpm dev` reconcilia os contratos incrementais de banco exigidos pela
versão atual e confirma as RPCs críticas no schema cache do PostgREST.

Quando for necessário reparar apenas o backend local sem iniciar outro servidor
Web, use:

```bash
pnpm prepare:local
```

Esse comando não executa `db reset`, não apaga dados e não reaplica migrations
que já estão completas.

## Compatibilidade do runtime

O Web está fixado em Next.js 16.3.3. Essa versão corrige a resolução dos
helpers ESM no pacote standalone sob Node.js 22 e incorpora as correções de
segurança da linha 16.3.x. Não rebaixar para 16.3.1: qualquer alteração desse
runtime deve atualizar o lockfile e repetir o Quality Gate e o AutoQA.

## Paridade com produção

Com as variáveis públicas do Supabase local disponíveis no processo:

```bash
pnpm build:web
pnpm start:standalone
```

O segundo comando copia `public` e `.next/static` para o pacote standalone e
inicia o servidor mínimo em `http://127.0.0.1:3000`. O endpoint
`/api/health` deve responder HTTP 200 sem divulgar configuração ou segredos.

## Contêiner portável

O `Dockerfile` usa Node.js 22, pnpm 11.22.0, usuário não privilegiado e health
check. Os três valores `NEXT_PUBLIC_*` são públicos e entram no bundle no
momento do build; nenhuma chave `sb_secret_...` ou `service_role` pode ser
usada como argumento ou variável pública.

Exemplo de build futuro:

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321 \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUBSTITUIR \
  -t orbiq-web:local .
```

O contêiner é uma opção de portabilidade, não uma obrigação para o trabalho
diário e não cria recursos externos ou custos.

## Critério de promoção futura

Quando houver orçamento, o artefato aprovado poderá seguir para Vercel Pro ou
outro provedor comercial. Antes disso ainda serão obrigatórios: Supabase
hospedado aprovado, variáveis por ambiente, domínio, URLs de Auth, observação
de logs, teste Preview e plano de rollback.
