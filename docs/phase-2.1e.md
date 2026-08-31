# Fase 2.1E — Higiene do repositório

## Objetivo

Remover artefatos temporários de documentação que não fazem parte do histórico canônico das fases e impedir que notas auxiliares semelhantes voltem a permanecer versionadas.

## Entrega

- remove `docs/phase-2.1d-note.txt`;
- remove `docs/phase-2.1d-extra.md`;
- preserva `docs/phase-2.1d.md` como documento canônico da fase anterior;
- adiciona AutoQA para impedir arquivos de fase com sufixos temporários `-extra.md` e `-note.txt`.

## Escopo de risco

Nenhuma migration, dado, RLS, cache PWA, segredo, configuração de produção ou comportamento funcional do aplicativo é alterado.
