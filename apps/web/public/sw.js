const ORBIQ_CACHE_PREFIX = "orbiq-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(ORBIQ_CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Não há fetch handler por decisão de segurança: páginas autenticadas,
// respostas do Supabase e exportações nunca são gravadas em cache offline.
