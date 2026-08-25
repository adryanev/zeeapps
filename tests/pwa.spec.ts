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

  test("removes stale versioned caches when a new service worker activates", async ({ page }) => {
    await page.goto("/");
    await waitForServiceWorker(page);

    await page.evaluate(async () => {
      const staleCache = await caches.open("dunia-zee-v0");
      await staleCache.put("/stale-marker", new Response("stale"));

      const registration = await navigator.serviceWorker.register(
        "/service-worker.js?version=cache-update-test",
      );
      const activeWorker = registration.active ?? registration.installing ?? registration.waiting;
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
    });

    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .not.toContain("dunia-zee-v0");
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
