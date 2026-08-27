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
- Node.js 22+
- pnpm 11.22.0
- Docker Desktop em execução

Na raiz do repositório:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

O comando `pnpm dev` faz o bootstrap seguro do ambiente local:

1. confirma/inicia o Supabase local;
2. valida os objetos de banco exigidos pela Fase 1.9G e, quando necessário, aplica somente a migration desta fase sem reset destrutivo;
3. solicita a recarga do schema cache do PostgREST e confirma a publicação da RPC;
4. injeta as credenciais públicas do Supabase local no processo web;
5. valida o contrato público de ambiente e bloqueia chaves privilegiadas;
6. verifica se a porta 3000 está livre;
7. inicia o Next.js em `http://localhost:3000`.

Isso protege o ambiente contra schema local desatualizado ao trocar de branch e evita falsos erros de RPC ausente no schema cache do PostgREST. O histórico completo de migrations continua validado pelo Quality Gate em um banco limpo.

Para iniciar somente o Next.js, sem preparar o backend:

```bash
pnpm dev:web
```

## Qualidade

O projeto possui Quality Gate, Playwright/AutoQA, migrations versionadas e tipos gerados a partir do PostgreSQL/Supabase.

O pacote `@orbiq/config` centraliza o contrato compartilhável de ambiente para
Web e para o futuro aplicativo mobile. A aplicação encerra a inicialização com
mensagem objetiva se alguma variável obrigatória estiver ausente, inválida ou
contiver uma chave privilegiada.

Consulte `apps/web/README.md` para o fluxo Web e os endpoints operacionais.

O antigo Google Apps Script continua operacional durante a migração controlada para a nova plataforma.
