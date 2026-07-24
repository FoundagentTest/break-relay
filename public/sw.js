const CACHE_PREFIX = "break-relay";
const APP_VERSION = "__BREAK_RELAY_BUILD__";
const CACHE_NAME = `${CACHE_PREFIX}-${APP_VERSION}`;
const CORE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

async function cacheCurrentShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexResponse = await fetch("/index.html", { cache: "reload" });
  if (!indexResponse.ok) throw new Error("Could not cache app shell");

  await cache.put("/index.html", indexResponse.clone());
  await cache.put("/", indexResponse.clone());

  const html = await indexResponse.text();
  const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
    .map((match) => match[1]);
  const paths = [...new Set([...CORE.slice(2), ...assetPaths])];
  await Promise.all(
    paths.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (response.ok) await cache.put(path, response);
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheCurrentShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("/index.html", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match("/index.html")) || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      });
    }),
  );
});
