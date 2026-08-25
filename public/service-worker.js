const CACHE_VERSION = "1";
const CACHE_NAME = `dunia-zee-v${CACHE_VERSION}`;
const CACHE_PREFIX = "dunia-zee-";
const SHELL_RESOURCES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cacheShellResources(cache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  event.respondWith(cacheFirstResource(request));
});

async function cacheShellResources(cache) {
  const shellResponse = await fetch("/", { cache: "no-store" });
  if (shellResponse.ok) {
    const shellBody = await shellResponse.clone().text();
    await cache.put("/", shellResponse.clone());
    await cache.put("/index.html", shellResponse.clone());

    const documentResources = extractDocumentResources(shellBody);
    await Promise.all(
      [...SHELL_RESOURCES, ...documentResources].map((resource) => cacheResource(cache, resource)),
    );
    return;
  }

  await Promise.all(SHELL_RESOURCES.map((resource) => cacheResource(cache, resource)));
}

function extractDocumentResources(documentBody) {
  const resources = [];
  const resourcePattern = /(?:src|href)=["']([^"']+)["']/g;
  let match = resourcePattern.exec(documentBody);

  while (match) {
    const resourceUrl = new URL(match[1], self.location.origin);
    if (resourceUrl.origin === self.location.origin) {
      resources.push(`${resourceUrl.pathname}${resourceUrl.search}`);
    }
    match = resourcePattern.exec(documentBody);
  }

  return resources;
}

async function cacheResource(cache, resource) {
  try {
    const response = await fetch(resource, { cache: "no-store" });
    if (response.ok) {
      await cache.put(resource, response);
    }
  } catch {
    // A missing optional resource must not prevent the shell from installing.
  }
}

async function networkFirstDocument(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreVary: true })) ??
      (await cache.match("/index.html", { ignoreVary: true })) ??
      Response.error()
    );
  }
}

async function cacheFirstResource(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request, { ignoreVary: true });
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}
