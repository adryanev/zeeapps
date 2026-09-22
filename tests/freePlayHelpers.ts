import { expect, type Page } from "@playwright/test";

export async function startFreePlay(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
  await expect(page.locator(".free-play-controls")).toBeVisible();
  await expect(page.getByTestId("child-stage")).toHaveAttribute("aria-busy", "false");
  // Inspect the real scene through its loaded module, without a production debug global.
  await page.evaluate(async () => {
    const resource = performance.getEntriesByType("resource").find(entry => entry.name.includes("/DepotTenangScene-"));
    if (!resource) throw new Error("Scene bundle missing");
    const { DepotTenangScene: Scene } = await import(resource.name);
    const original = Scene.prototype.updateVisuals;
    await new Promise<void>(resolve => {
      Scene.prototype.updateVisuals = function (dt: number) {
        Scene.prototype.updateVisuals = original;
        (window as any).__fleetScene = this;
        original.call(this, dt);
        resolve();
      };
    });
  });
}

// Position sampling supplements DOM outcomes with actual movement evidence.

export async function position(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__fleetScene.truckX);
}
