import { expect, test } from "@playwright/test";
import { startFreePlay } from "./freePlayHelpers";

test("washing feedback freezes on pause and settles to a still canvas", async ({ page }) => {
  await startFreePlay(page);
  await page.getByRole("button", {name: "Cuci pesawat", exact: true}).click();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-dirty", "4");
  await page.evaluate(() => (window as any).__fleetScene.setPaused(true));
  const canvas = page.locator("canvas");
  // Let the renderer present the paused state before comparing actual pixels.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const frozen = await canvas.screenshot();
  await page.waitForTimeout(200);
  expect(await canvas.screenshot()).toEqual(frozen);
  await page.evaluate(() => (window as any).__fleetScene.setPaused(false));
  await expect.poll(() => page.evaluate(() => {
    const s = (window as any).__fleetScene;
    return s.materials.drops.some((drop: any) => drop.visible) || s.materials.bursts.length > 0 || s.materials.mud[0].visible;
  })).toBe(false);
  const idle = await canvas.screenshot();
  await page.waitForTimeout(200);
  expect(await canvas.screenshot()).toEqual(idle);
});

test("changing activity removes water and feedback immediately", async ({ page }) => {
  await startFreePlay(page);
  await page.getByRole("button", {name: "Cuci pesawat", exact: true}).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", {name: "Bangun jembatan", exact: true}).click();
  expect(await page.evaluate(() => {
    const s = (window as any).__fleetScene;
    return {
      drops: s.materials.drops.some((drop: any) => drop.visible),
      bursts: s.materials.bursts.length,
      stream: s.materials.stream.commandBuffer.length,
      shadow: s.airplaneShadow.visible,
    };
  })).toEqual({drops: false, bursts: 0, stream: 0, shadow: false});
});

test("Reduced Motion retains washing and loading without flying particles or suspension", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Reduced Motion").check();
  await startFreePlay(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.rocks.filter((r: any) => r.state === "bed").length)).toBe(3);
  expect(await page.evaluate(() => (window as any).__fleetScene.truck.body.y)).toBe(0);
  await page.getByRole("button", {name: "Cuci pesawat", exact: true}).click();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-dirty", "4");
  expect(await page.evaluate(() => (window as any).__fleetScene.materials.drops.some((drop: any) => drop.visible))).toBe(false);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.flight)).toBeGreaterThan(0.2);
  expect(await page.evaluate(() => (window as any).__fleetScene.airplane.visual.rotation)).toBe(0);
});
