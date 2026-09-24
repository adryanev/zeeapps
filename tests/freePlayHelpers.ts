import { expect, type Page } from "@playwright/test";

export async function startFreePlay(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
  await expect(page.locator(".free-play-controls")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("child-stage")).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
}

export async function attachWorld(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const resource = performance.getEntriesByType("resource").find(entry => entry.name.includes("/DepotTenang3D-"));
    if (!resource) throw new Error("3D game bundle missing");
    const { DepotTenang3D } = await import(resource.name);
    const original = DepotTenang3D.prototype.update;
    await new Promise<void>(resolve => {
      DepotTenang3D.prototype.update = function (dt: number) {
        DepotTenang3D.prototype.update = original;
        (window as any).__fleetWorld = this;
        original.call(this, dt);
        resolve();
      };
    });
  });
}

export async function tapModel(
  page: Page,
  kind: "rock" | "form" | "mud" | "supply" | "pit" | "truck",
  index = 0,
  touch = false,
): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(({ kind, index }) => {
    const world = (window as any).__fleetWorld;
    const target = kind === "rock" ? world.rocks[index].target
      : kind === "form" ? world.forms[index].children.find((child: any) => child.userData.action === "form")
      : kind === "mud" ? world.mud[index].children.find((child: any) => child.userData.action === "mud")
      : world[kind].children.find((child: any) => child.userData.action === kind);
    if (!target) throw new Error(`Missing ${kind} target`);
    target.updateWorldMatrix(true, false);
    world.camera.updateMatrixWorld();
    const projected = target.getWorldPosition(target.position.clone()).project(world.camera);
    const bounds = world.canvas.getBoundingClientRect();
    return {
      x: bounds.x + (projected.x + 1) * bounds.width / 2,
      y: bounds.y + (1 - projected.y) * bounds.height / 2,
    };
  }, { kind, index });
  const viewport = page.viewportSize()!;
  expect(point.x).toBeGreaterThanOrEqual(0);
  expect(point.x).toBeLessThanOrEqual(viewport.width);
  expect(point.y).toBeGreaterThanOrEqual(0);
  expect(point.y).toBeLessThanOrEqual(viewport.height);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  return point;
}
