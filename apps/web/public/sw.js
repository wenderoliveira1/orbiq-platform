const CACHE_PREFIX = "orbiq-";
const CACHE_NAME = `${CACHE_PREFIX}public-shell-v1`;
const PUBLIC_SHELL = ["/offline", "/icon.svg", "/manifest.webmanifest"];
const PUBLIC_PATHS = new Set(PUBLIC_SHELL);
const CONNECTIVITY_MESSAGE = "ORBIQ_CONNECTIVITY";

let offlineNavigationPending = false;

globalThis.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await globalThis.caches.open(CACHE_NAME);
      await cache.addAll(
        PUBLIC_SHELL.map(
          (path) =>
            new globalThis.Request(path, {
              cache: "reload",
              credentials: "omit",
            }),
        ),
      );
      await globalThis.skipWaiting();
    })(),
  );
});

globalThis.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await globalThis.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => globalThis.caches.delete(key)),
      );
      await globalThis.clients.claim();
    })(),
  );
});

globalThis.addEventListener("message", (event) => {
  if (
    event.data?.type !== CONNECTIVITY_MESSAGE ||
    typeof event.data.online !== "boolean"
  ) {
    return;
  }

  offlineNavigationPending = !event.data.online;
});

async function offlineResponse() {
  const cached = await globalThis.caches.match("/offline");

  return (
    cached ??
    new globalThis.Response("Orbiq está sem conexão.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 503,
    })
  );
}

globalThis.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== globalThis.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    if (offlineNavigationPending) {
      offlineNavigationPending = false;
      event.respondWith(offlineResponse());
      return;
    }

    event.respondWith(
      globalThis.fetch(request).catch(() => offlineResponse()),
    );
    return;
  }

  if (PUBLIC_PATHS.has(url.pathname)) {
    event.respondWith(
      globalThis.caches
        .match(url.pathname)
        .then((cached) => cached ?? globalThis.fetch(request)),
    );
  }
});
