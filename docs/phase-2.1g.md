# Fase 2.1G — Runtime reproduzível

## Objetivo

Reduzir variação entre máquinas e CI fixando explicitamente a toolchain usada para instalar, compilar e testar o Orbiq.

## Entrega

- declara `pnpm@11.22.0` no `packageManager` da raiz;
- restringe Node.js à linha 22 a partir de `22.23.2`;
- adiciona `.node-version` com `22.23.2`;
- Quality Gate e AutoQA passam a instalar `node@22.23.2` em vez de um alias flutuante;
- ambos os workflows verificam a versão real de Node.js e pnpm antes de instalar dependências;
- AutoQA dedicado impede regressão para runtimes divergentes.

## Benefício operacional

Um build aprovado em CI fica menos sujeito a mudar de comportamento apenas porque uma nova versão de runtime foi publicada entre duas execuções. Atualizações futuras de Node.js ou pnpm passam a ser mudanças explícitas, revisáveis e testáveis.

## Escopo de risco

Nenhuma migration, dado, RLS, cache PWA, segredo, dependência da aplicação ou configuração de produção é alterado.
