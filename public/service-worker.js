const DEFAULT_CACHE_VERSION = "__DUNIA_ZEE_CACHE_VERSION__";
const CACHE_PREFIX = "dunia-zee-";
const CACHE_VERSION = getCacheVersion();
const CACHE_NAME = `${CACHE_PREFIX}v${CACHE_VERSION}`;
const FETCH_TIMEOUT_MS = 10_000;
const ERROR_HEADER = "X-Dunia-Zee-Error";
const APP_SCOPE_URL = new URL(self.registration.scope);
const APP_BASE_PATH = APP_SCOPE_URL.pathname;
const SHELL_RESOURCES = [
  APP_BASE_PATH,
  resolveAppPath("index.html"),
  resolveAppPath("manifest.webmanifest"),
  resolveAppPath("icons/icon.svg"),
  resolveAppPath("icons/icon-192.svg"),
  resolveAppPath("icons/icon-512.svg"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cacheShellResources(cache);
        await self.skipWaiting();
      } catch (error) {
        await reportServiceWorkerError("install", error);
        throw error;
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        );
        await self.clients.claim();
      } catch (error) {
        await reportServiceWorkerError("activate", error);
        throw error;
      }
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

function getCacheVersion() {
  const requestedVersion = new URL(self.location.href).searchParams.get("v");
  const cacheVersion = requestedVersion ?? DEFAULT_CACHE_VERSION;
  return /^[A-Za-z0-9._-]+$/.test(cacheVersion) ? cacheVersion : DEFAULT_CACHE_VERSION;
}

async function cacheShellResources(cache) {
  const shellResponse = await fetchWithTimeout(APP_BASE_PATH, { cache: "no-store" });
  if (shellResponse.ok) {
    const shellBody = await shellResponse.clone().text();
    await cache.put(APP_BASE_PATH, shellResponse.clone());
    await cache.put(resolveAppPath("index.html"), shellResponse.clone());

    const documentResources = extractDocumentResources(shellBody);
    await Promise.all(
      [...SHELL_RESOURCES, ...documentResources].map((resource) => cacheResource(cache, resource)),
    );
    return;
  }

  await reportServiceWorkerError("shell", new Error(`Shell request returned ${shellResponse.status}.`));
  await Promise.all(SHELL_RESOURCES.map((resource) => cacheResource(cache, resource)));
}

function extractDocumentResources(documentBody) {
  const resources = [];
  const resourcePattern = /(?:src|href)=["']([^"']+)["']/g;
  let match = resourcePattern.exec(documentBody);

  while (match) {
    const resourceUrl = new URL(match[1], APP_SCOPE_URL);
    if (
      resourceUrl.origin === self.location.origin &&
      resourceUrl.pathname.startsWith(APP_BASE_PATH)
    ) {
      resources.push(`${resourceUrl.pathname}${resourceUrl.search}`);
    }
    match = resourcePattern.exec(documentBody);
  }

  return resources;
}

async function cacheResource(cache, resource) {
  try {
    const response = await fetchWithTimeout(resource, { cache: "no-store" });
    if (response.ok) {
      await cache.put(resource, response);
    } else {
      await reportServiceWorkerError("resource", new Error(`${resource} returned ${response.status}.`));
    }
  } catch (error) {
    await reportServiceWorkerError("resource", error);
  }
}

async function networkFirstDocument(request) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch (error) {
    return createFailureResponse("cache", error);
  }

  try {
    const response = await fetchWithTimeout(request);
    if (response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        await reportServiceWorkerError("cache", error);
      }
    }
    return response;
  } catch (error) {
    try {
      return (
        (await cache.match(request, { ignoreVary: true })) ??
        (await cache.match(resolveAppPath("index.html"), { ignoreVary: true })) ??
        createFailureResponse("document", error)
      );
    } catch (cacheError) {
      return createFailureResponse("cache", cacheError);
    }
  }
}

function resolveAppPath(relativePath) {
  return new URL(relativePath, APP_SCOPE_URL).pathname;
}

async function cacheFirstResource(request) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request, { ignoreVary: true });
    if (cachedResponse) {
      return cachedResponse;
    }
  } catch (error) {
    return createFailureResponse("cache", error);
  }

  try {
    const response = await fetchWithTimeout(request);
    if (response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        await reportServiceWorkerError("cache", error);
      }
    }
    return response;
  } catch (error) {
    return createFailureResponse("resource", error);
  }
}

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timeoutTimer = self.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    self.clearTimeout(timeoutTimer);
  }
}

function createFailureResponse(kind, error) {
  void reportServiceWorkerError(kind, error);
  return new Response(
    "Dunia Zee could not load this resource. Return to the Playroom and try again.",
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        [ERROR_HEADER]: kind,
      },
    },
  );
}

async function reportServiceWorkerError(kind, error) {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const message = {
      type: "dunia-zee-error",
      kind,
      message: error instanceof Error ? error.message : String(error),
    };
    for (const client of clients) {
      client.postMessage(message);
    }
  } catch (notificationError) {
    console.error("Dunia Zee could not report a service-worker error.", notificationError);
  }
}
