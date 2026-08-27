# Orbiq Web

Interface Web profissional do Orbiq, construída com Next.js, React e
TypeScript sobre o backend Supabase multiempresa.

## Execução local

Na raiz do repositório:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

O bootstrap inicia o Supabase local, verifica o schema, injeta somente a chave
pública e abre o Web em `http://localhost:3000`.

Use `pnpm dev:web` apenas quando o Supabase e as três variáveis públicas já
estiverem disponíveis no processo.

## Contrato de ambiente

Variáveis obrigatórias:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Os valores `NEXT_PUBLIC_*` entram no bundle durante `next build`. Portanto,
cada ambiente deve gerar seu próprio artefato com os valores correspondentes.
O parser compartilhado em `@orbiq/config`:

- exige URLs absolutas sem credenciais, caminhos ou query strings;
- aceita `sb_publishable_...` e a chave `anon` JWT legada;
- recusa `sb_secret_...`, `service_role` e formatos desconhecidos;
- nunca registra o valor das chaves nos logs.

O arquivo `environment.example` contém somente nomes e exemplos fictícios.
Arquivos `.env*` reais não podem ser versionados.

## Build e runtime portável

```bash
pnpm build:web
pnpm start:standalone
```

O mesmo artefato é exercitado pelo AutoQA. O contêiner opcional usa Node.js 22,
usuário não privilegiado e os endpoints:

- `GET /api/health`: processo Web ativo;
- `GET /api/ready`: contrato de configuração válido;
- `GET /api/release`: identidade sanitizada da release em execução.

Todos retornam respostas mínimas sem segredos e com cache desabilitado.

## PWA e conectividade

O build de produção registra um service worker de escopo raiz. Ele oferece uma
tela pública quando uma navegação completa acontece sem rede e mantém um aviso
de conectividade na interface já aberta.

Por segurança, o cache offline contém exclusivamente a tela `/offline`, o
manifesto e os ícones públicos de instalação. Dashboard, APIs, respostas
Supabase, dados de clientes, orçamentos e exportações nunca entram no Cache
Storage. Em desenvolvimento, o registro é removido para não interferir no HMR.
O shell público também fica fora do proxy de renovação da sessão, mantendo a
recuperação independente do Auth.

A rota `/instalar` traz orientações específicas para iPhone/iPad, Android e
desktop. Em ambiente externo, a instalação depende de HTTPS; `localhost` e
`127.0.0.1` são aceitos pelos navegadores para testes locais.

### Atualizações instaladas

Uma nova versão do service worker não assume a sessão silenciosamente. Ela fica
em espera e o Orbiq exibe um aviso com as opções **Depois** e **Atualizar agora**.
A aplicação recomenda salvar qualquer edição antes da atualização e só recarrega
a página depois de uma confirmação explícita do usuário e da troca efetiva do
controller.

As verificações de nova versão acontecem ao iniciar, recuperar conectividade,
retornar à aba e periodicamente. Nenhum desses eventos força reload ou grava
dados autenticados em cache.

## Diagnóstico e suporte

A rota autenticada `/dashboard/suporte` executa verificações locais de saúde,
prontidão, identidade da release, manifesto, conectividade, service worker e
modo de instalação. O objetivo é permitir uma primeira triagem técnica sem
depender de observabilidade externa ou compartilhar conteúdo de negócio.

O relatório copiável da página é deliberadamente sanitizado. Ele não inclui
e-mail, nome da oficina, clientes, veículos, placas, orçamentos, URLs internas,
corpos de resposta, chaves, tokens ou stack traces. Para o primeiro atendimento,
compartilhe somente o bloco identificado como **Diagnóstico seguro**.

## Identidade de release e rollback

A Fase 2.0J introduz uma identidade segura para cada artefato em execução. O
endpoint `/api/release` publica somente `service`, `version`, `release`, `commit`
curto e `channel`. Valores arbitrários de ambiente não são refletidos na resposta.

A origem do commit segue, nesta ordem:

1. `ORBIQ_RELEASE_SHA`, quando definido explicitamente;
2. `VERCEL_GIT_COMMIT_SHA`, em uma futura implantação Vercel;
3. `GITHUB_SHA`, durante CI;
4. `local`, quando nenhum SHA confiável estiver disponível.

`ORBIQ_RELEASE_ID` é opcional e só é aceito se contiver caracteres seguros e no
máximo 64 posições. O canal é classificado como `production`, `preview`, `ci` ou
`local`. Esses dados também entram no **Diagnóstico seguro**, permitindo saber
exatamente qual versão apresentou um problema e voltar para um artefato anterior
sem pedir dados da oficina ao usuário.

Nenhuma chave, URL interna, token ou variável privilegiada é exposta por esse
contrato.

## Exportações privadas de dados

A portabilidade owner-only continua gerando no PostgreSQL o snapshot sanitizado,
com SHA-256 e limite lógico de 50 MiB. A entrega, porém, não usa mais o corpo da
resposta de uma Route do Next.js.

O navegador autenticado:

1. consome a autorização de uso único pelo RPC existente;
2. valida localmente o SHA-256 do snapshot;
3. envia o JSON diretamente ao bucket privado `organization-data-exports`;
4. cria uma URL assinada válida por 60 segundos;
5. recebe o Blob diretamente do Supabase Storage;
6. dispara o download local e remove o objeto temporário.

O bucket aceita somente `application/json`, permanece privado e limita o artefato
a 55 MiB para acomodar o manifesto de integridade em torno do snapshot de até
50 MiB. INSERT e SELECT exigem o proprietário autenticado e uma exportação
consumida nos últimos 15 minutos. DELETE permanece disponível ao mesmo
proprietário para recuperação de limpeza. Não existe policy de UPDATE/upsert.

Essa arquitetura elimina a dependência de limites de payload da futura
hospedagem Web sem exigir `service_role`, Function privilegiada, Vercel Pro ou
qualquer serviço adicional. Se a aba for interrompida depois do upload, a rota
de entrega consegue retomar o objeto privado dentro da janela curta de
recuperação.

## Qualidade

Toda promoção passa por pull request, Quality Gate e AutoQA. A `main` não
recebe edição direta e nenhuma publicação externa é necessária para desenvolver
ou validar o aplicativo localmente.
