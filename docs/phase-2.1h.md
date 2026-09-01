# Fase 2.1H — Guardas da toolchain Supabase

## Objetivo

Reduzir drift silencioso na ferramenta que inicializa, valida e gera tipos do ambiente Supabase local/CI.

## Entrega

- Quality Gate verifica `pnpm exec supabase --version` antes do gate técnico;
- AutoQA executa a mesma verificação antes de iniciar o ambiente isolado;
- a versão esperada permanece `2.115.0`, exatamente a resolução registrada no lockfile;
- uma regressão AutoQA garante que os dois workflows preservem o contrato;
- nenhuma migration, dado, RLS, segredo, cache PWA ou configuração de produção é alterado.

## Por que isso importa

O pacote raiz permite a linha compatível `^2.115.0`, mas o lockfile congela a resolução efetiva usada pelo repositório. A verificação explícita transforma essa resolução em um gate operacional: uma atualização futura do lockfile que também altere a CLI precisa ser deliberada e acompanhada da atualização do contrato e dos testes.

## Gate

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
