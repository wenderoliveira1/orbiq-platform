import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifest = readFileSync(
  resolve(root, "apps/web/src/app/manifest.ts"),
  "utf8",
);
const serviceWorker = readFileSync(
  resolve(root, "apps/web/public/sw.js"),
  "utf8",
);

function fail(message) {
  console.error(`[FALHA] ${message}`);
  process.exit(1);
}

function requireMatch(source, pattern, description) {
  if (!pattern.test(source)) fail(description);
}

requireMatch(manifest, /display:\s*["']standalone["']/, "PWA precisa permanecer em modo standalone.");
requireMatch(manifest, /start_url:\s*["']\/dashboard["']/, "PWA precisa iniciar no dashboard.");
requireMatch(manifest, /scope:\s*["']\/["']/, "PWA precisa manter scope raiz.");
requireMatch(manifest, /id:\s*["']\/dashboard["']/, "PWA precisa manter identidade estável no dashboard.");
requireMatch(manifest, /lang:\s*["']pt-BR["']/, "PWA precisa declarar o idioma operacional pt-BR.");
requireMatch(manifest, /src:\s*["']\/icons\/orbiq-192\.png["']/, "Ícone PWA 192x192 ausente.");
requireMatch(manifest, /src:\s*["']\/icons\/orbiq-512\.png["']/, "Ícone PWA 512x512 ausente.");
requireMatch(manifest, /orbiq-maskable-512\.png/, "Ícone maskable do PWA ausente.");
requireMatch(manifest, /url:\s*["']\/dashboard\/orcamentos\/novo["']/, "Atalho de novo orçamento ausente.");
requireMatch(manifest, /url:\s*["']\/dashboard\/orcamentos["']/, "Atalho de orçamentos ausente.");

requireMatch(serviceWorker, /const CACHE_PREFIX = ["']orbiq-["'];/, "Prefixo do cache PWA não está isolado.");
requireMatch(serviceWorker, /const CACHE_NAME = `\$\{CACHE_PREFIX\}public-shell-v3`;/, "Nome do cache público do PWA perdeu a versão esperada.");
requireMatch(serviceWorker, /PUBLIC_SHELL = \[/, "Shell público do PWA não está declarado explicitamente.");
requireMatch(serviceWorker, /["']\/offline["']/, "Fallback offline não faz parte do shell público.");
requireMatch(serviceWorker, /["']\/manifest\.webmanifest["']/, "Manifesto não faz parte do shell público.");
requireMatch(serviceWorker, /credentials: ["']omit["']/, "Pré-cache do shell não pode enviar credenciais.");
requireMatch(serviceWorker, /cache: ["']reload["']/, "Pré-cache do shell deve ignorar uma resposta HTTP obsoleta.");
requireMatch(serviceWorker, /startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/, "Caches antigos do Orbiq precisam ser removidos.");
requireMatch(serviceWorker, /clients\.claim\(\)/, "Service worker precisa assumir clientes após ativação.");
requireMatch(serviceWorker, /skipWaiting\(\)/, "Service worker precisa suportar atualização explícita.");
requireMatch(serviceWorker, /request\.method !== ["']GET["']/, "Service worker não pode interceptar métodos mutáveis.");
requireMatch(serviceWorker, /url\.origin !== globalThis\.location\.origin/, "Service worker não pode interceptar origens externas.");
requireMatch(serviceWorker, /request\.mode === ["']navigate["']/, "Navegação precisa ter caminho explícito para fallback offline.");
requireMatch(serviceWorker, /globalThis\.fetch\(request\)\.catch\(\(\) => offlineResponse\(\)\)/, "Falha de navegação precisa cair no offline shell.");
requireMatch(serviceWorker, /PUBLIC_PATHS\.has\(url\.pathname\)/, "Somente caminhos públicos explícitos podem usar o cache do PWA.");

if (/\/api\//.test(serviceWorker)) {
  fail("O service worker não deve incluir endpoints de API no shell cacheável.");
}

if (/credentials:\s*["']include["']/.test(serviceWorker)) {
  fail("O service worker não pode pré-carregar recursos com credenciais incluídas.");
}

console.log("[OK] Contrato PWA verificado");
console.log("[OK] Manifesto, shell offline, atualização e isolamento de cache permanecem protegidos");
