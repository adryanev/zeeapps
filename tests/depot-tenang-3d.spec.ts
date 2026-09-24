import { expect, test } from "@playwright/test";
import { attachWorld, startFreePlay, tapModel } from "./freePlayHelpers";

test("opens a real 3D diorama with Blender vehicles", async ({ page }) => {
  await startFreePlay(page);
  await expect(page.locator("canvas[aria-label='Diorama Depot Tenang 3D']")).toBeVisible();
  await expect(page.getByTestId("game-status")).toHaveText("Sentuh batu di rel");
  await expect(page.locator(".activity-picker button")).toHaveCount(3);
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name));
  expect(resources.some(url => url.endsWith("fleet-dump.glb"))).toBe(true);
  expect(resources.some(url => url.endsWith("fleet-train.glb"))).toBe(true);
  expect(resources.some(url => url.endsWith("env-station.glb"))).toBe(true);
  expect(await page.locator("canvas").evaluate(canvas => !(canvas as HTMLCanvasElement).getContext("webgl2")?.isContextLost())).toBe(true);
});

test("rocks clear the track and falling cargo collides with the block pile", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.trainX)).toBeCloseTo(-2.6, 1);
  for (let index = 0; index < 3; index++) await tapModel(page, "rock", index);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load", "3");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.trainX)).toBeGreaterThan(-0.7);
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.rocks.every((rock: any) => rock.state === "bed"))).toBe(true);
  await page.locator("#game-mount").focus();
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.truckTarget), { timeout: 12_000 }).toBeUndefined();
  await expect(page.getByTestId("game-status")).toHaveText("Angkat bak truk");
  const blockStarts = await page.evaluate(() => (window as any).__fleetWorld.blocks.map((block: any) => block.body.translation()));
  await page.keyboard.press("Space");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered", "3", { timeout: 8_000 });
  await expect.poll(() => page.evaluate((starts) => {
    const world = (window as any).__fleetWorld;
    return Math.max(...world.blocks.map((block: any, index: number) => {
      const position = block.body.translation();
      const start = starts[index];
      return Math.hypot(position.x - start.x, position.y - start.y, position.z - start.z);
    }));
  }, blockStarts), { timeout: 6_000 }).toBeGreaterThan(0.2);
  const rocks = await page.evaluate(() => (window as any).__fleetWorld.rocks.map((rock: any) => ({ state: rock.state, dynamic: rock.body?.isDynamic() })));
  expect(rocks).toEqual([{ state: "falling", dynamic: true }, { state: "falling", dynamic: true }, { state: "falling", dynamic: true }]);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-remaining", "3", { timeout: 12_000 });
});

test("three fast mold taps queue pours, complete a bridge, and let the cargo truck cross", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.getByRole("button", { name: "Bangun jembatan", exact: true }).click();
  for (let index = 0; index < 3; index++) await tapModel(page, "form", index);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-bridge", "3", { timeout: 18_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.cargoX)).toBeGreaterThan(-10);
  await expect(page.getByTestId("game-status")).toHaveText("Jembatan jadi! Truk bisa lewat");
  await page.locator("#game-mount").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-bridge", "0");
});

test("washing clears five visible patches, launches the plane, and can repeat", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.getByRole("button", { name: "Cuci pesawat", exact: true }).click();
  for (let index = 0; index < 5; index++) await tapModel(page, "mud", index);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-dirty", "0");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.airplane.position.y), { timeout: 5_000 }).toBeGreaterThan(0.3);
  await tapModel(page, "supply");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-dirty", "5");
  expect(await page.evaluate(() => (window as any).__fleetWorld.flight)).toBe(0);
});

test("Companion Gate pauses the train and resumes it without resetting play", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  for (let index = 0; index < 3; index++) await tapModel(page, "rock", index);
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.trainX)).toBeGreaterThan(-0.5);
  await page.keyboard.down("Shift");
  await page.keyboard.down("Enter");
  await expect(page.getByTestId("companion-gate")).toBeVisible();
  await page.keyboard.up("Enter");
  await page.keyboard.up("Shift");
  const before = await page.evaluate(() => (window as any).__fleetWorld.trainX);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).__fleetWorld.trainX)).toBeCloseTo(before, 3);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.trainX)).toBeGreaterThan(before + 0.2);
});

test.describe("phone touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("all three activities respond to visible model taps", async ({ page }) => {
    await startFreePlay(page);
    await attachWorld(page);
    await tapModel(page, "rock", 0, true);
    await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load", "1");
    await page.getByRole("button", { name: "Bangun jembatan", exact: true }).tap();
    await tapModel(page, "form", 0, true);
    await expect(page.getByTestId("child-stage")).toHaveAttribute("data-bridge", "1", { timeout: 8_000 });
    await page.getByRole("button", { name: "Cuci pesawat", exact: true }).tap();
    await tapModel(page, "mud", 0, true);
    await expect(page.getByTestId("child-stage")).toHaveAttribute("data-dirty", "4");
  });

  test("the camera follows the dump truck and keeps the unloading pit touchable", async ({ page }) => {
    await startFreePlay(page);
    await attachWorld(page);
    for (let index = 0; index < 3; index++) await page.getByTestId("vehicle-action").tap();
    await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load", "3");
    await page.getByTestId("vehicle-action").tap();
    await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.truckTarget), { timeout: 12_000 }).toBeUndefined();
    const pit = await tapModel(page, "pit", 0, true);
    expect(pit.x).toBeGreaterThan(35);
    expect(pit.x).toBeLessThan(355);
    await page.getByTestId("vehicle-action").tap();
    await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered", "3", { timeout: 8_000 });
  });

  test("portrait and landscape keep the board and choices inside the viewport", async ({ page }) => {
    await startFreePlay(page);
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(async () => {
        const rect = await page.locator("canvas").boundingBox();
        return rect ? Math.abs(rect.width / rect.height - (viewport.width < viewport.height ? (viewport.width / (viewport.height - 140)) : 16 / 9)) < 0.15 : false;
      }).toBe(true);
      for (const selector of ["canvas", ".activity-picker", "[data-testid='vehicle-action']"]) {
        if (viewport.width > viewport.height && selector.includes("vehicle-action")) continue;
        const rect = (await page.locator(selector).boundingBox())!;
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
        expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
  });
});

test.describe("model download failure", () => {
  test.use({ serviceWorkers: "block" });

  test("shows Retry and can recover", async ({ page }) => {
    let failed = false;
    await page.route("**/env-tree.glb", route => {
      if (!failed) { failed = true; return route.abort(); }
      return route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-load-error")).toBeVisible({ timeout: 12_000 });
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByTestId("game-load-error")).toBeHidden();
  });
});
