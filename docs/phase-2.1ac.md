# Fase 2.1AC — Integridade das permissões da imagem

## Objetivo

Comprovar que o filesystem da aplicação na imagem de produção não contém permissões que facilitem alteração indevida ou elevação de privilégios.

## Entrega

- percorre recursivamente o diretório `/app` dentro do container em execução;
- ignora links simbólicos para não seguir caminhos fora do runtime da aplicação;
- bloqueia arquivos e diretórios graváveis por grupo ou por qualquer usuário;
- bloqueia bits setuid e setgid no conteúdo da aplicação;
- retorna apenas a quantidade de violações ao processo de teste e uma falha genérica aos logs;
- preserva usuário não-root, filesystem somente leitura, lifecycle, limites, privacidade e higiene da imagem;
- não altera Dockerfile, aplicação, migrations, dados, RLS, segredos, cache PWA ou produção.

## Base

Criada diretamente da `main` após o merge da Fase 2.1AB (`a88b18e834637c78d5c6af555abbc7b3a0666d69`).

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
