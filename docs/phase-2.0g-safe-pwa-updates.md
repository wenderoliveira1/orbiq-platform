# Fase 2.0G — Atualizações seguras do PWA

## Objetivo

Criar um ciclo de atualização previsível para o Orbiq instalado como Web App,
sem recarregar a aplicação automaticamente enquanto o usuário trabalha e sem
armazenar qualquer dado autenticado no service worker.

## Comportamento

- o navegador verifica uma nova versão no carregamento, ao recuperar conexão,
  ao voltar para a aba e a cada 30 minutos;
- um worker novo permanece em `waiting` e não assume a sessão atual sozinho;
- a interface exibe **Nova versão disponível** somente quando existe worker
  aguardando;
- **Depois** mantém a sessão atual e não interrompe o trabalho;
- **Atualizar agora** envia uma mensagem explícita ao worker em espera;
- somente após `controllerchange` provocado por essa ação a página é recarregada;
- nenhuma atualização força reload silencioso.

## Proteção contra perda de trabalho

O aviso orienta o usuário a salvar qualquer edição antes de aplicar a versão.
O Orbiq não tenta inferir estado de formulário nem recarrega automaticamente,
porque isso poderia criar falsos positivos ou descartar trabalho legítimo.

## Service worker

A instalação deixou de executar `skipWaiting()` automaticamente. O worker só
recebe promoção antecipada quando processa a mensagem `ORBIQ_SKIP_WAITING`.
O cache público foi versionado para `public-shell-v3`; a allowlist permanece
restrita a `/offline`, manifesto e ícones públicos.

## Segurança e privacidade

Nenhuma API, dashboard, resposta Supabase, cliente, veículo, orçamento,
exportação, token ou conteúdo de formulário entra no Cache Storage. O ciclo de
atualização altera somente o controle do service worker e os assets públicos já
permitidos pelas fases anteriores.

## Evidência automática

O AutoQA valida que:

1. o `install` não contém promoção automática por `skipWaiting`;
2. a mensagem `ORBIQ_SKIP_WAITING` existe no worker;
3. o aviso de atualização aparece em viewport mobile sem overflow;
4. a aplicação informa explicitamente para salvar edições;
5. `Atualizar agora` envia a mensagem correta ao worker em espera.
