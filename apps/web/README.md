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
- `GET /api/ready`: contrato de configuração válido.

Ambos retornam respostas mínimas sem segredos e com cache desabilitado.

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
prontidão, manifesto, conectividade, service worker e modo de instalação. O
objetivo é permitir uma primeira triagem técnica sem depender de observabilidade
externa ou compartilhar conteúdo de negócio.

O relatório copiável da página é deliberadamente sanitizado. Ele não inclui
e-mail, nome da oficina, clientes, veículos, placas, orçamentos, URLs internas,
corpos de resposta, chaves, tokens ou stack traces. Para o primeiro atendimento,
compartilhe somente o bloco identificado como **Diagnóstico seguro**.

## Qualidade

Toda promoção passa por pull request, Quality Gate e AutoQA. A `main` não
recebe edição direta e nenhuma publicação externa é necessária para desenvolver
ou validar o aplicativo localmente.
