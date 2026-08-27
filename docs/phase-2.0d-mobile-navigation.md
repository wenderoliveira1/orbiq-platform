# Fase 2.0D — Navegação mobile profissional

## Objetivo

Substituir a faixa horizontal com até vinte opções por uma navegação pensada
para telas pequenas, sem reduzir permissões, esconder recursos ou alterar o
sidebar desktop.

## Experiência móvel

- cabeçalho compacto com oficina ativa e botão de menu;
- dock inferior com Visão geral, Novo orçamento e Orçamentos;
- quarto atalho para abrir o menu completo;
- painel lateral agrupado em Visão e gestão, Operação, Cadastros e
  Administração;
- troca de oficina e encerramento de sessão disponíveis no mobile;
- suporte a safe areas de iPhone e altura dinâmica do navegador;
- conteúdo com espaço inferior reservado para o dock, sem sobreposição.

Os atalhos respeitam a mesma matriz de permissões do menu completo. Se um perfil
não possui determinada permissão, o item não é renderizado em nenhum dos dois.

## Acessibilidade

O painel móvel usa semântica de diálogo modal, nome acessível, estado
`aria-expanded`, foco inicial previsível, ciclo de Tab contido, fechamento por
Escape e retorno do foco ao botão que abriu o menu. O scroll da página é
bloqueado somente enquanto o painel está aberto e restaurado no cleanup.

Animações são removidas quando o sistema solicita movimento reduzido.

## Arquitetura

A lista de rotas, rótulos, ícones, grupos, permissões e regra de rota ativa
existe em um único módulo. Desktop, dock e painel móvel consomem essa mesma
fonte, impedindo divergência entre menus.

O componente cliente recebe somente os dados mínimos serializáveis: permissões,
identificação da oficina, lista de oficinas autorizadas e e-mail da sessão. O
contexto, a autenticação e a autorização continuam resolvidos no servidor.

## Estratégia Web/mobile

Esta fase melhora o Web responsivo e a PWA agora, sem confundir essa camada com
o futuro aplicativo React Native/Expo. O mobile nativo continuará usando o
mesmo backend, contrato de ambiente e matriz de permissões, mas terá navegação
própria quando `apps/mobile` for iniciado.
