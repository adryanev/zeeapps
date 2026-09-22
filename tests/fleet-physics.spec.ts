import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { FLEET, carriageOffset, rollingAngle } from "../src/game/vehicleGeometry";

import { startFreePlay } from "./freePlayHelpers";

test("released train preserves rail contact and coupling distances", async ({ page }) => {
  await startFreePlay(page);
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.trainBodies[0].position.x)).toBeGreaterThan(500);
  const positions = await page.evaluate(() => (window as any).__fleetScene.trainBodies.map((b: any) => ({ ...b.position })));
  for (const [index, p] of positions.entries()) {
    const model = index === 0 ? FLEET.train : FLEET.carriage;
    expect(p.y + model.railContact.y).toBeCloseTo(213, 1);
    if (index) {
      const ahead = index === 1 ? FLEET.train : FLEET.carriage;
      const gap = positions[index - 1].x + ahead.couplerRear.x - p.x - model.couplerFront.x;
      expect(gap).toBeGreaterThan(2);
      expect(gap).toBeLessThan(10);
    }
  }
});

test("generated wheel contacts and coupler heights agree with each model", () => {
  for (const model of [FLEET.train, FLEET.carriage]) {
    for (const wheel of model.wheels) {
      expect(wheel.y + model.wheelRadius * model.wheelAspect).toBeCloseTo(model.railContact.y, 0);
    }
  }
  const offset = carriageOffset(0);
  expect(FLEET.train.couplerRear.y).toBeCloseTo(offset.y + FLEET.carriage.couplerFront.y, 0);
  expect(rollingAngle(FLEET.cargo.wheelRadius * Math.PI * 2, FLEET.cargo.wheelRadius)).toBeCloseTo(Math.PI * 2, 8);
  expect(rollingAngle(-10, 5)).toBe(-2);
});

test("every rendered fleet frame has transparent padding instead of clipped geometry", async ({ page }) => {
  await page.goto("/");
  const files = ["truck-body-sol", "truck-tanker-body", "truck-mixer-body", "truck-mining-dump-body", "train-locomotive-sol", "train-carriage-sol", "airplane-body", "cargo-crate-sol",
    ...Array.from({ length: FLEET.mixer.animationFrames - 1 }, (_, i) => `truck-mixer-body-${i + 1}`),
    ...Array.from({ length: FLEET.dump.animationFrames - 1 }, (_, i) => `truck-mining-dump-body-${i + 1}`)];
  for (const file of files) {
    const result = await page.evaluate(async name => {
      const image = new Image();
      image.src = `/assets/depot-tenang-v2/${name}.png`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      let borderAlpha = 0, opaquePixels = 0;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const alpha = pixels[(y * image.width + x) * 4 + 3];
        if (alpha > 32) opaquePixels++;
        if (x < 8 || y < 8 || x >= image.width - 8 || y >= image.height - 8) borderAlpha = Math.max(borderAlpha, alpha);
      }
      return { borderAlpha, opaquePixels, width: image.width, height: image.height };
    }, file);
    expect(result.borderAlpha, file).toBe(0);
    expect(result.opaquePixels, file).toBeGreaterThan(1_000);
    expect(result.width / result.height).toBe(1.5);
  }
});

test("mixer and dump frames contain different rendered poses", () => {
  for (const [name, frames] of [["truck-mixer-body", FLEET.mixer.animationFrames], ["truck-mining-dump-body", FLEET.dump.animationFrames]] as const) {
    const hashes = Array.from({ length: frames }, (_, index) => {
      const suffix = index ? `-${index}` : "";
      const png = readFileSync(`public/assets/depot-tenang-v2/${name}${suffix}.png`);
      return createHash("sha256").update(png).digest("hex");
    });
    expect(new Set(hashes).size, name).toBe(frames);
  }
});
