# Promoção segura de release do Orbiq

Este procedimento mantém o desenvolvimento local e prepara a futura publicação Web sem depender de um provedor específico.

## 1. Validar o artefato antes de publicar

Execute:

```bash
pnpm release:drill
```

O drill gera o build de produção, prepara o Next.js standalone, sobe o artefato em uma porta isolada e comprova `health`, `ready` e a identidade de release ligada ao commit atual. Ele não faz deploy externo e não executa reset destrutivo.

## 2. Validar o destino que será promovido

Com o artefato local ativo ou com as variáveis públicas do ambiente externo configuradas, execute:

```bash
pnpm release:preflight
```

O preflight verifica:

- `GET /api/health`;
- `GET /api/ready`;
- `GET /api/release`;
- manifesto PWA, `scope`, `start_url` e ícones;
- service worker com MIME JavaScript e `Cache-Control: no-store`;
- shell público (`/login`, `/offline`, `/instalar`) com headers mínimos de segurança;
- HTTPS obrigatório quando o destino não é local.

A saída é sanitizada e não imprime chaves, tokens, usuários ou dados de oficina.

## 3. Regra de promoção

Uma release só deve ser promovida quando os quatro sinais estiverem verdes:

1. Quality Gate;
2. AutoQA;
3. `pnpm release:drill`;
4. `pnpm release:preflight`.

Em futura hospedagem Web, o mesmo preflight deve ser executado contra o domínio candidato antes de tratá-lo como produção.

## 4. Rollback

Use `/api/release` ou o Diagnóstico seguro para identificar `release`, `commit` e `channel` do artefato problemático. O rollback deve apontar para um artefato previamente aprovado pelos mesmos gates, sem alterar o banco nem executar resets como parte da reversão do Web.
