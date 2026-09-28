import { expect, test } from "@playwright/test";
import { attachWorld, startFreePlay, tapModel } from "./freePlayHelpers";

test("cement emerges near the mixer chute and lands in the selected form", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.getByRole("button", { name: "Bangun jembatan", exact: true }).click();
  await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    const original = world.effect;
    world.effect = function (name: string, position: any, length: number, duration: number, end?: any, control?: any) {
      if (name === "material-concrete-drop" && !(window as any).__firstPour) {
        const chute = this.truckModels.build.getObjectByName("Mixer_Chute");
        chute.updateWorldMatrix(true, false);
        const origin = chute.getWorldPosition(chute.position.clone().set(0, 0, 0));
        (window as any).__firstPour = {
          origin: origin.toArray(), drop: position.toArray(), end: end?.toArray(),
          form: this.forms[0].position.toArray(), guideVisible: this.pourGuide.visible,
        };
      }
      return original.call(this, name, position, length, duration, end, control);
    };
  });
  await tapModel(page, "form", 0);
  await expect.poll(() => page.evaluate(() => (window as any).__firstPour)).toBeDefined();
  const pour = await page.evaluate(() => (window as any).__firstPour);
  expect(Math.hypot(pour.drop[0] - pour.origin[0], pour.drop[2] - pour.origin[2])).toBeLessThan(0.8);
  expect(Math.hypot(pour.end[0] - pour.form[0], pour.end[2] - pour.form[2])).toBeLessThan(0.2);
  expect(pour.guideVisible).toBe(true);
});

test("tanker spray reaches the mud before its splash fades in place", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.getByRole("button", { name: "Cuci pesawat", exact: true }).click();
  await tapModel(page, "mud", 0);
  const { before, after, patch, sprayStart, valve, patchWasVisible, patchStayedVisible, patchIsHidden } = await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    world.paused = true;
    const jet = world.effects.at(-1);
    const sprayStart = jet.start.toArray();
    const valve = world.truckModels.wash.getObjectByName("Tanker_Rear_Valve_Box")
      .getWorldPosition(world.truck.position.clone()).toArray();
    const patchWasVisible = world.mud[0].visible;
    world.stepEffects(0.25);
    const patchStayedVisible = world.mud[0].visible;
    world.stepEffects(0.65);
    const effect = world.effects.at(-1);
    const before = { position: effect.visual.position.toArray(), scale: effect.visual.scale.x };
    const patch = world.mud[0].getWorldPosition(world.mud[0].position.clone()).toArray();
    const patchIsHidden = !world.mud[0].visible;
    world.stepEffects(0.3);
    const after = { position: effect.visual.position.toArray(), scale: effect.visual.scale.x };
    return { before, after, patch, sprayStart, valve, patchWasVisible, patchStayedVisible, patchIsHidden };
  });
  expect(Math.hypot(...sprayStart.map((value: number, index: number) => value - valve[index]))).toBeLessThan(0.05);
  expect(patchWasVisible).toBe(true);
  expect(patchStayedVisible).toBe(true);
  expect(patchIsHidden).toBe(true);
  expect(Math.hypot(...before.position.map((value: number, index: number) => value - patch[index]))).toBeLessThan(0.05);
  expect(Math.abs(after.position[1] - before.position[1])).toBeLessThan(0.15);
  expect(after.scale / before.scale).toBeLessThan(1.1);
});

test("changing activities during a spray keeps the washed patch clean", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.getByRole("button", { name: "Cuci pesawat", exact: true }).click();
  await tapModel(page, "mud", 0);
  await page.getByRole("button", { name: "Bangun jembatan", exact: true }).click();
  await page.getByRole("button", { name: "Cuci pesawat", exact: true }).click();
  const state = await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    return { dirty: world.dirty[0], visible: world.mud[0].visible, effects: world.effects.length };
  });
  expect(state).toEqual({ dirty: false, visible: false, effects: 0 });
});

test("airplane gains speed gently after washing and levels off at the end", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.getByRole("button", { name: "Cuci pesawat", exact: true }).click();
  const positions = await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    world.paused = true;
    world.dirty.fill(false);
    world.mud.forEach((patch: any) => { patch.visible = false; });
    world.sprayTime = 0;
    const samples: number[] = [world.airplane.position.x];
    const apronHeights: number[] = [];
    for (let frame = 1; frame <= 240; frame++) {
      world.update(1 / 60);
      if (world.airplane.position.x < 0.5) apronHeights.push(world.airplane.position.y);
      if (frame % 12 === 0) samples.push(world.airplane.position.x);
    }
    return { samples, pitch: world.airplane.rotation.z, apronHeight: Math.max(...apronHeights), finalHeight: world.airplane.position.y };
  });
  const movement = positions.samples.slice(1).map((x, index) => x - positions.samples[index]);
  expect(movement[0]).toBeLessThan(movement[9] * 0.35);
  expect(movement.at(-1)).toBeLessThan(movement[9] * 0.35);
  expect(positions.pitch).toBeCloseTo(0, 2);
  expect(positions.apronHeight).toBeLessThan(0.25);
  expect(positions.finalHeight).toBeGreaterThan(5);
});

test("airplane nose points along the flight path", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.getByRole("button", { name: "Cuci pesawat", exact: true }).click();
  const alignment = await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    world.paused = true;
    world.dirty.fill(false);
    world.mud.forEach((patch: any) => { patch.visible = false; });
    world.sprayTime = 0;
    world.flight = 2;
    world.update(1 / 60);
    const previous = world.airplane.position.clone();
    world.update(1 / 60);
    const travel = world.airplane.position.clone().sub(previous).setY(0).normalize();
    const nose = world.airplane.getObjectByName("Airplane_Nose")
      .getWorldPosition(world.airplane.position.clone());
    const fuselage = world.airplane.getObjectByName("Airplane_Fuselage")
      .getWorldPosition(world.airplane.position.clone());
    const heading = nose.sub(fuselage).setY(0).normalize();
    return heading.dot(travel);
  });
  expect(alignment).toBeGreaterThan(0.95);
});
