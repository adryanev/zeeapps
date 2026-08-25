import { expect, test } from "@playwright/test";

test.describe("Dunia Zee PWA", () => {
  test("exposes installability metadata for the standalone Playroom", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("link[rel='manifest']")).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
    await expect(page.locator("meta[name='theme-color']")).toHaveAttribute(
      "content",
      "#f5ede1",
    );

    const manifestResponse = await page.request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBeTruthy();
    const manifest = (await manifestResponse.json()) as {
      display?: string;
      start_url?: string;
      theme_color?: string;
      background_color?: string;
      icons?: Array<{ src?: string; sizes?: string; type?: string }>;
    };

    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#f5ede1");
    expect(manifest.background_color).toBe("#f5ede1");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/svg+xml" }),
        expect.objectContaining({ sizes: "512x512", type: "image/svg+xml" }),
      ]),
    );
  });

  test("shows calm loading feedback and recovers when the Game bundle is unavailable", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await waitForServiceWorker(page);
    await context.setOffline(true);

    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-load-error")).toBeVisible();
    await expect(page.getByTestId("game-load-error")).toContainText("Coba lagi");
    await expect(page.locator("canvas")).toHaveCount(0);

    await context.setOffline(false);
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByTestId("game-loading")).toBeHidden();
    await expect(page.getByTestId("game-load-error")).toBeHidden();
  });

  test("shows a recoverable warning when service-worker registration fails", async ({ page }) => {
    await page.addInitScript(() => {
      const serviceWorkerContainer = navigator.serviceWorker;
      const originalRegister = serviceWorkerContainer.register.bind(serviceWorkerContainer);
      let shouldFail = true;
      Object.defineProperty(serviceWorkerContainer, "register", {
        configurable: true,
        value: (...args: Parameters<ServiceWorkerContainer["register"]>) => {
          if (shouldFail) {
            shouldFail = false;
            return Promise.reject(new Error("service worker unavailable"));
          }

          return originalRegister(...args);
        },
      });
    });
    await page.goto("/");

    await expect(page.getByTestId("service-worker-error")).toBeVisible();
    await expect(page.getByTestId("service-worker-error")).toContainText("Offline");

    await page.getByTestId("service-worker-retry").click();
    await expect(page.getByTestId("service-worker-error")).toBeHidden();
  });

  test("returns a visible recoverable response when an uncached resource cannot load", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await waitForServiceWorker(page);
    await context.setOffline(true);

    const result = await page.evaluate(async () => {
      const response = await fetch("/uncached-pwa-resource.js");
      return {
        body: await response.text(),
        errorKind: response.headers.get("x-dunia-zee-error"),
        status: response.status,
      };
    });

    expect(result.status).toBe(503);
    expect(result.errorKind).toBe("resource");
    expect(result.body).toContain("try again");
  });

  test("relaunches the Playroom and complete Game from the offline cache", async ({ page, context }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("playroom")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mulai Depot Tenang" })).toBeEnabled();

    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
  });

  test("replaces the complete old cache without mixed-version resources", async ({ page }) => {
    await page.goto("/");
    await waitForServiceWorker(page);

    const previousCacheName = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const currentCacheName = cacheNames.find((cacheName) => cacheName.startsWith("dunia-zee-v"));
      if (!currentCacheName) {
        throw new Error("The active service worker cache is missing");
      }

      const staleCache = await caches.open(currentCacheName);
      await staleCache.put("/mixed-version-marker", new Response("old deployment"));
      await staleCache.put("/index.html", new Response("old deployment shell"));
      return currentCacheName;
    });
    const nextCacheName = `dunia-zee-vdeployment-${Date.now()}`;
    const nextVersion = nextCacheName.slice("dunia-zee-v".length);

    await page.evaluate(async (version) => {
      const registration = await navigator.serviceWorker.register(
        `/service-worker.js?v=${version}`,
      );
      const activeWorker = registration.installing ?? registration.waiting ?? registration.active;
      if (!activeWorker) {
        throw new Error("Service worker did not start installing");
      }
      if (activeWorker.state !== "activated") {
        await new Promise<void>((resolve, reject) => {
          activeWorker.addEventListener("statechange", () => {
            if (activeWorker.state === "activated") {
              resolve();
            }
            if (activeWorker.state === "redundant") {
              reject(new Error("Service worker became redundant"));
            }
          });
        });
      }
    }, nextVersion);

    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .toEqual([nextCacheName]);

    const cacheState = await page.evaluate(async (cacheName) => {
      const activeCache = await caches.open(cacheName);
      const shell = await activeCache.match("/index.html");
      const mixedMarker = await caches.match("/mixed-version-marker");
      return {
        hasMixedMarker: mixedMarker !== undefined,
        shell: shell ? await shell.text() : "",
      };
    }, nextCacheName);

    expect(previousCacheName).not.toBe(nextCacheName);
    expect(cacheState.hasMixedMarker).toBe(false);
    expect(cacheState.shell).toContain("<!doctype html>");
  });
});

async function waitForServiceWorker(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not available");
    }

    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) {
      return;
    }

    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
  });
}
