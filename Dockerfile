# syntax=docker/dockerfile:1.7

FROM node:22.23.2-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

FROM base AS dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

ENV NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL"
ENV NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

RUN pnpm build:web && pnpm prepare:standalone

FROM node:22.23.2-alpine AS runner

WORKDIR /app

ARG NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV="production"
ENV NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL"
ENV NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
ENV PORT="3000"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/ready || exit 1

STOPSIGNAL SIGTERM

CMD ["node", "apps/web/server.js"]
