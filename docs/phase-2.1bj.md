# Fase 2.1BJ — Placa no novo orçamento

## Objetivo

Na montagem do orçamento, digitar a placa precisa trazer o cliente e o veículo na hora — sem obrigar o operador a achar o cliente primeiro.

## Entrega

- campo **Placa do veículo** ao lado da busca por telefone em Novo Orçamento;
- normalização da placa (maiúscula, sem hífen/espaço);
- preenchimento de `customer_id` e `vehicle_id` no builder existente;
- AutoQA estático `phase-2.1bj-quote-plate-lookup`.

## Fora de escopo

- sem migration, RLS, RPC ou alteração de fórmula;
- sem projeto paralelo;
- busca por telefone permanece.
