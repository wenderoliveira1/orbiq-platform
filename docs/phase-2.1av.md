# Fase 2.1AV — Telemetria local segura da atualização do PWA

## Objetivo

Transformar o contrato da Fase 2.1AU em um componente reutilizável, pequeno e seguro para acompanhar o ciclo de atualização do PWA sem rede, sessão, cookies ou dados da oficina.

## Entrega

- tipos fechados para eventos e fontes permitidos;
- validação de timestamp e tentativa entre `0` e `3`;
- buffer local limitado a 20 entradas;
- resumo mínimo para diagnóstico seguro;
- serialização somente dos campos do contrato;
- nenhuma chamada de rede, gravação em Cache Storage ou inclusão de identidade operacional.

## Critérios de aceite

1. Eventos fora do conjunto permitido não compilam como contrato válido.
2. Tentativas negativas ou maiores que 3 são rejeitadas.
3. O buffer remove entradas antigas e nunca cresce sem limite.
4. O resumo expõe somente contagem, último evento e última tentativa.
5. A serialização não contém e-mail, organização, cliente, veículo, placa, orçamento, URL, token ou corpo de resposta.
6. A fase permanece independente de banco, migrations, RLS, segredos e deploy externo.
