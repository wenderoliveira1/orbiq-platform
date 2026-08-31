# Fase 2.0Y — Recuperação segura do schema local

## Incidente reproduzido

As páginas de Rede, Atividade e Confiabilidade utilizam a RPC
`get_owned_organization_overview(date)`. Um banco local preservado de uma
branch anterior podia não possuir as Fases 1.9D, 1.9E e 1.9F, embora o
bootstrap validasse apenas 1.9G e 2.0I. O Next.js iniciava normalmente e a
incompatibilidade aparecia somente ao abrir essas telas.

## Correção estrutural

O bootstrap agora mantém um registro ordenado dos contratos locais exigidos:

- visão consolidada e atividade da rede;
- incidentes e confiabilidade;
- continuidade e governança de dados;
- Storage privado de exportações;
- limites defensivos de escrita de orçamentos.

Cada fase possui uma prova direta no catálogo do PostgreSQL. Apenas a migration
cuja prova falhar é executada, em transação e sem `db reset`. Depois, a prova é
repetida antes de avançar.

## PostgREST

Não basta a função existir no PostgreSQL. O bootstrap recarrega o schema cache
e consulta as quatro RPCs de leitura usadas pela interface. O Web só inicia
quando todas deixarem de retornar `PGRST202`/função ausente.

## Reparo independente

`pnpm prepare:local` executa a mesma reconciliação sem verificar a porta 3000 e
sem iniciar o Next.js. Assim, um ambiente já aberto pode ser reparado e
recarregado com segurança.

## Evidência automática

O AutoQA remove deliberadamente as três RPCs relacionadas ao incidente,
executa o modo de reparo e comprova que:

- as migrations corretas são reaplicadas;
- as funções reaparecem no PostgreSQL;
- o PostgREST volta a publicá-las;
- nenhuma instância adicional do servidor Web é iniciada.
