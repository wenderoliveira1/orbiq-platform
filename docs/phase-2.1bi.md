# Fase 2.1BI — Histórico operacional de cliente e veículo

## Objetivo

Quando a placa ou o cliente volta, a oficina precisa ver o que já foi feito, o km da última visita e o protocolo — sem caçar na lista de orçamentos.

## Entrega

- helper puro de visitas (`buildVisitHistory`) sobre `quotes` + `quote_services`;
- páginas `/dashboard/clientes/[id]` e `/dashboard/veiculos/[id]`;
- painel **Histórico deste veículo** no detalhe do orçamento (`no-print`);
- Novo Orçamento aceita `?customer=&vehicle=`, preenche identidade e km da última visita (não o snapshot desatualizado do cadastro);
- atalhos Histórico / Novo orçamento nas listas de cadastro;
- AutoQA estático `phase-2.1bi-customer-vehicle-history`.

## Fora de escopo

- sem migration, RLS, RPC ou alteração de fórmula;
- sem custo/lucro/margem no histórico (só data, km, status, serviços);
- sem mudança na folha do cliente / link público / impressão.

## Promoção

Promover somente com Quality Gate e AutoQA verdes no mesmo HEAD.
