# Fase 2.0A — Publicação Web profissional

## Objetivo

Publicar o Orbiq como aplicação Web responsiva e instalável, usando o mesmo backend Supabase que atenderá Web, mobile nativo e desktop no futuro.

## Arquitetura de entrega

- Next.js 16 na Vercel ou em hospedagem comercial equivalente;
- Supabase hospedado para Auth, PostgreSQL, Storage e RLS;
- previews isolados por pull request;
- produção promovida somente depois de Quality Gate e AutoQA;
- arquivos privados entregues por Storage e URL assinada curta, nunca por bucket público;
- PWA em modo network-only para não persistir dados pessoais no cache do navegador.

## Configuração do projeto Web

- Root Directory: `apps/web`
- Framework: Next.js
- Node.js: 22
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`

## Variáveis públicas obrigatórias

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Nenhuma chave `sb_secret_...` ou `service_role` pode receber o prefixo `NEXT_PUBLIC_`.

## Sequência de publicação

1. criar o projeto Supabase na organização aprovada e na região escolhida;
2. aplicar migrations e executar Security/Performance Advisors;
3. criar o projeto Web em plano compatível com uso comercial;
4. configurar variáveis separadas para Preview e Production;
5. validar a URL Preview com AutoQA e viewport mobile;
6. promover exatamente o artefato aprovado para Production;
7. configurar domínio, URLs de Auth, logs, alertas e rollback.

## Bloqueios externos atuais

A criação do Supabase exige confirmação da organização, região e custo apresentado pela plataforma. A conta Vercel conectada ainda não possui projeto e está no plano Hobby, inadequado para produção comercial.
