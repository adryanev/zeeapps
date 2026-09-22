import { expect, test } from "@playwright/test";
import { FLEET } from "../src/game/vehicleGeometry";
import { startFreePlay } from "./freePlayHelpers";

test("dump frames retain logical size when the resting texture has a different resolution", async ({page}) => {
  await startFreePlay(page);
  // Reproduce an older resting asset alongside newer high resolution animation frames.
  await page.evaluate(() => {
    const s = (window as any).__fleetScene;
    const source = s.textures.get("dump").getSourceImage();
    const texture = s.textures.createCanvas("dump-half", source.width / 2, source.height / 2);
    texture.context.drawImage(source, 0, 0, source.width / 2, source.height / 2);
    texture.refresh();
    s.textures.renameTexture("dump", "dump-original");
    s.textures.renameTexture("dump-half", "dump");
    s.truck.body.setTexture("dump").setDisplaySize(248, 248 * 2 / 3);
    s.truckX = 410;
    s.tiltTarget = 1;
  });
  await page.waitForFunction(() => (window as any).__fleetScene.truck.body.texture.key === "dump-12");
  const size = await page.evaluate(() => {
    const s = (window as any).__fleetScene;
    return {width: s.truck.body.displayWidth, height: s.truck.body.displayHeight, scale: s.truck.visual.scaleX};
  });
  expect(size.width).toBeCloseTo(FLEET.dump.spriteWidth, 5);
  expect(size.height).toBeCloseTo(FLEET.dump.spriteHeight, 5);
  expect(size.scale).toBe(1.65);
  await page.evaluate(() => { (window as any).__fleetScene.tiltTarget = 0; });
  await page.waitForFunction(() => (window as any).__fleetScene.truck.body.texture.key === "dump");
  expect(await page.evaluate(() => (window as any).__fleetScene.truck.body.displayWidth)).toBeCloseTo(FLEET.dump.spriteWidth, 5);
});
