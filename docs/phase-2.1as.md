# Fase 2.1AS — UX de atualização do PWA em runtime

## Objetivo

Comprovar no navegador que a atualização do PWA continua explícita quando existe um service worker novo aguardando ativação, sem recarregar a página antes da confirmação do usuário.

## Entrega

- simulação E2E de um service worker aguardando ativação;
- ação `Depois` dispensa a atualização sem enviar comando ao worker;
- ação `Atualizar agora` envia somente `ORBIQ_SKIP_WAITING`;
- estado de atualização permanece visível até a troca de controller;
- rota de instalação usada como superfície pública estável para o teste.

## Segurança

Somente testes E2E e documentação. Nenhuma migration, dado, RLS, segredo ou configuração de produção é alterada.

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
