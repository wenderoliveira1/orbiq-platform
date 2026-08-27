# Fase 2.0F — Instalação multiplataforma

## Objetivo

Preparar o Orbiq para instalação profissional no iPhone, iPad, Android e
desktop sem depender de loja, prompt proprietário ou hospedagem paga nesta
etapa.

## Identidade de instalação

- PNG `192x192` e `512x512` para navegadores que exigem raster;
- PNG maskable `512x512` com fundo opaco e símbolo dentro da safe zone;
- Apple Touch Icon `180x180` e metadados de Web App;
- SVG preservado como opção escalável;
- manifesto com tamanhos, MIME e propósitos explícitos.

O vetor maskable é mantido como fonte versionada e os PNGs são rasterizações
determinísticas dele e do ícone oficial. Nenhuma marca externa ou asset remoto é
usado.

## Experiência

A opção **Instalar aplicativo** aparece no sidebar desktop e no drawer mobile.
A rota pública `/instalar` explica os passos próprios de Safari/iOS,
Chrome/Android e Chrome/Edge desktop, além da exigência de HTTPS na futura
publicação.

Não usamos `beforeinstallprompt`: a documentação do Next.js não recomenda esse
fluxo como experiência principal porque ele não funciona no Safari/iOS. A
orientação permanece progressiva e compatível entre plataformas.

## Desktop futuro

O manifesto declara `launch_handler: focus-existing` para que navegadores
compatíveis reutilizem a janela instalada, evitando múltiplas instâncias da
operação. Navegadores sem suporte ignoram a propriedade e mantêm `standalone`.

## Cache e segurança

O cache público da Fase 2.0E foi versionado e ampliado somente com os quatro PNGs
de instalação. O AutoQA continua exigindo a allowlist exata; nenhum dado de
negócio foi incluído.

## Evidência automática

O AutoQA valida assinatura PNG, dimensões do IHDR, MIME, ícone maskable,
atalhos do manifesto, metadados Apple, acesso pelo menu mobile e ausência de
overflow em 390 px.
