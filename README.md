# Orbiq Platform

Plataforma profissional de operações automotivas, preparada para evolução SaaS e web.

## Web
- Next.js
- React
- TypeScript
- Tailwind CSS

## Backend
- Supabase
- PostgreSQL
- Auth
- Row Level Security
- Storage

## Estrutura

- `apps/web` — aplicação Web (App Router)
- `packages/types` — tipos gerados do Postgres
- `packages/validation` — pacote compartilhado (placeholder)
- `packages/config` — contrato de ambiente público
- `supabase` — migrations e config local
- `scripts` — bootstrap, quality gate, release
- `tests` — AutoQA / Playwright

> Mobile (React Native / Expo) está no roadmap; ainda não há `apps/mobile` neste repositório.

## Desenvolvimento local

Pré-requisitos:
- Node.js 22.23.2 (ver `.node-version`)
- pnpm 11.22.0
- Docker Desktop em execução

Na raiz do repositório:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

O comando `pnpm dev` faz o bootstrap seguro do ambiente local:

1. confirma/inicia o Supabase local;
2. verifica os contratos incrementais exigidos pelas Fases 1.9D–2.0S;
3. aplica somente as migrations ausentes, na ordem correta e dentro de
   transações, sem reset destrutivo;
4. recarrega o schema cache e confirma as quatro RPCs críticas no PostgREST;
5. injeta somente as credenciais públicas do Supabase local no processo Web;
6. valida o contrato público de ambiente e bloqueia chaves privilegiadas;
7. verifica se a porta 3000 está livre;
8. inicia o Next.js em `http://localhost:3000`.

Isso protege o ambiente contra schema local desatualizado ao trocar de branch e
evita páginas liberadas sem as funções de rede, confiabilidade ou dados. O
bootstrap incremental preserva os dados existentes; o histórico completo de
migrations continua validado pelo Quality Gate em um banco limpo.

Para reparar somente o banco e o cache, sem iniciar outro servidor Web:

```bash
pnpm prepare:local
```

Para iniciar somente o Next.js, sem preparar o backend:

```bash
pnpm dev:web
```

## Qualidade

```bash
pnpm quality
pnpm test:autoqa
```

O projeto possui Quality Gate, Playwright/AutoQA, migrations versionadas e tipos gerados a partir do PostgreSQL/Supabase.

O pacote `@orbiq/config` centraliza o contrato compartilhável de ambiente. A aplicação encerra a inicialização com mensagem objetiva se alguma variável obrigatória estiver ausente, inválida ou contiver uma chave privilegiada.

Consulte `apps/web/README.md` para o fluxo Web, PWA, suporte e entrega privada de exportações.

O antigo Google Apps Script continua operacional durante a migração controlada para a nova plataforma.
