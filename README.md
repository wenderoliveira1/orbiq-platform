# Orbiq Platform

Plataforma profissional de operações automotivas, preparada para evolução SaaS, web e mobile.

## Web
- Next.js
- React
- TypeScript
- Tailwind CSS

## Mobile
- React Native
- Expo

## Backend
- Supabase
- PostgreSQL
- Auth
- Row Level Security
- Storage

## Estrutura

- `apps/web`
- `packages/types`
- `packages/validation`
- `packages/config`
- `supabase`
- `scripts`
- `tests`

## Desenvolvimento local

Pré-requisitos:
- Node.js 20+
- pnpm
- Docker Desktop em execução

Na raiz do repositório:

```bash
pnpm install
pnpm dev
```

O comando `pnpm dev` faz o bootstrap seguro do ambiente local:

1. confirma/inicia o Supabase local;
2. aplica migrations pendentes com `supabase migration up --local`;
3. injeta as credenciais públicas do Supabase local no processo web;
4. verifica se a porta 3000 está livre;
5. inicia o Next.js em `http://localhost:3000`.

Isso evita que uma troca de branch deixe o banco local atrás do código da aplicação, situação que pode produzir erros de RPC ausente no schema cache do PostgREST.

Para iniciar somente o Next.js, sem preparar o backend:

```bash
pnpm dev:web
```

Para aplicar somente migrations locais pendentes:

```bash
pnpm dev:sync-db
```

## Qualidade

O projeto possui Quality Gate, Playwright/AutoQA, migrations versionadas e tipos gerados a partir do PostgreSQL/Supabase.

O antigo Google Apps Script continua operacional durante a migração controlada para a nova plataforma.
