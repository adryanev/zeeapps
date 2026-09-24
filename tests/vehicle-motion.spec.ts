import { expect, test, type Page } from "@playwright/test";
import { attachWorld, startFreePlay, tapModel } from "./freePlayHelpers";

type WheelPose = {
  axis: [number, number, number];
  quaternion: [number, number, number, number];
  hubQuaternion: [number, number, number, number];
  radius: number;
  x: number;
  center: [number, number, number];
};

async function wheelPose(page: Page, vehicleName: "truck" | "train" | "carriage" | "cargo", wheelName: string): Promise<WheelPose> {
  return page.evaluate(({ vehicleName, wheelName }) => {
    const world = (window as any).__fleetWorld;
    const vehicle = vehicleName === "truck" ? world.truckModels.rocks
      : vehicleName === "train" ? world.train
      : vehicleName === "carriage" ? world.trainCars[0] : world.cargo;
    const wheel = vehicle.getObjectByName(wheelName);
    const hub = vehicle.getObjectByName(wheelName.replace("_Wheel_", "_Hub_"));
    if (!wheel || !hub) throw new Error(`Missing wheel pair ${wheelName}`);
    wheel.updateWorldMatrix(true, false);
    const center = wheel.localToWorld(wheel.position.clone().set(0, 0, 0));
    const axis = wheel.localToWorld(wheel.position.clone().set(0, 1, 0)).sub(center).normalize();
    wheel.geometry.computeBoundingBox();
    const bounds = wheel.geometry.boundingBox;
    const scale = wheel.getWorldScale(wheel.position.clone());
    const radius = (bounds.max.x - bounds.min.x) * scale.x / 2;
    return {
      axis: axis.toArray(), quaternion: wheel.quaternion.toArray(),
      hubQuaternion: hub.quaternion.toArray(), radius,
      x: vehicleName === "truck" ? world.truckX : vehicle.position.x,
      center: center.toArray(),
    };
  }, { vehicleName, wheelName });
}

async function measureWheelTravel(
  page: Page,
  vehicleName: "truck" | "train" | "cargo",
  wheelNames: string[],
): Promise<{ distance: number; wheels: { radius: number; angle: number }[] }> {
  return page.evaluate(({ vehicleName, wheelNames }) => {
    const world = (window as any).__fleetWorld;
    const startX = vehicleName === "truck" ? world.truckX
      : vehicleName === "train" ? world.trainX : world.cargoX;
    const wheels = wheelNames.map(name => {
      const vehicle = name.startsWith("Carriage_") ? world.trainCars[0]
        : vehicleName === "truck" ? world.truckModels.rocks
          : vehicleName === "train" ? world.train : world.cargo;
      const wheel = vehicle.getObjectByName(name);
      if (!wheel) throw new Error(`Missing wheel ${name}`);
      wheel.geometry.computeBoundingBox();
      const bounds = wheel.geometry.boundingBox;
      const scale = wheel.getWorldScale(wheel.position.clone());
      return {
        wheel,
        radius: (bounds.max.x - bounds.min.x) * scale.x / 2,
        previous: wheel.quaternion.clone(),
        angle: 0,
      };
    });
    return new Promise<{ distance: number; wheels: { radius: number; angle: number }[] }>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Vehicle did not travel")), 12_000);
      const sample = () => {
        for (const state of wheels) {
          const dot = Math.abs(state.previous.dot(state.wheel.quaternion));
          state.angle += 2 * Math.acos(Math.min(1, dot));
          state.previous.copy(state.wheel.quaternion);
        }
        const x = vehicleName === "truck" ? world.truckX
          : vehicleName === "train" ? world.trainX : world.cargoX;
        const distance = vehicleName === "truck" ? startX - x : x - startX;
        if (distance >= 0.5) {
          window.clearTimeout(timeout);
          resolve({ distance, wheels: wheels.map(({ radius, angle }) => ({ radius, angle })) });
        } else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }, { vehicleName, wheelNames });
}

function angleBetween(first: number[], second: number[]): number {
  const dot = Math.abs(first.reduce((sum, value, index) => sum + value * second[index], 0));
  return 2 * Math.acos(Math.min(1, dot));
}

function axisDot(first: number[], second: number[]): number {
  return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

test("truck tires and hubs roll without wobble or sliding", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.locator("#game-mount").focus();
  for (let index = 0; index < 3; index++) await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.rocks.every((rock: any) => rock.state === "bed"))).toBe(true);

  const before = await wheelPose(page, "truck", "Dump_Wheel_1");
  await page.keyboard.press("Space");
  const motion = await measureWheelTravel(page, "truck", ["Dump_Wheel_1"]);
  const after = await wheelPose(page, "truck", "Dump_Wheel_1");
  const wheel = motion.wheels[0];
  expect(axisDot(before.axis, after.axis)).toBeGreaterThan(0.995);
  expect(Math.abs(wheel.angle * wheel.radius - motion.distance)).toBeLessThan(0.15);
  expect(angleBetween(before.hubQuaternion, after.hubQuaternion)).toBeGreaterThan(0.3);
});

test("truck accelerates and brakes smoothly when moving to the unload point", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  const samples = await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    world.paused = true;
    world.truckTarget = -6.1;
    const result: Array<{ x: number; speed: number }> = [];
    for (let index = 0; index < 600 && world.truckTarget !== undefined; index++) {
      world.moveTruck(1 / 60);
      result.push({ x: world.truckX, speed: world.truckSpeed });
    }
    return { result, target: world.truckTarget };
  });
  const speeds = samples.result.map(sample => Math.abs(sample.speed));
  expect(samples.target).toBeUndefined();
  expect(samples.result.at(-1)?.x).toBeCloseTo(-6.1, 2);
  expect(speeds[0]).toBeLessThan(0.2);
  expect(speeds[10]).toBeGreaterThan(speeds[0] + 0.8);
  expect(Math.max(...speeds)).toBeLessThanOrEqual(5.2);
  expect(speeds.at(-6)).toBeGreaterThan(speeds.at(-2));
  expect(Math.max(...speeds.slice(1).map((speed, index) => Math.abs(speed - speeds[index])))).toBeLessThan(0.3);
  expect(samples.result.every((sample, index) => index === 0 || sample.x <= samples.result[index - 1].x)).toBe(true);
});

test("train stops before the first stone with a visible gap", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  const gap = await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    const edge = (object: any, side: "min" | "max") => {
      let value = side === "min" ? Infinity : -Infinity;
      object.updateWorldMatrix(true, true);
      object.traverse((mesh: any) => {
        if (!mesh.isMesh || !mesh.visible || mesh.userData?.action) return;
        mesh.geometry.computeBoundingBox();
        const bounds = mesh.geometry.boundingBox;
        const matrix = mesh.matrixWorld.elements;
        const x = matrix[0] * (matrix[0] >= 0 === (side === "max") ? bounds.max.x : bounds.min.x)
          + matrix[4] * (matrix[4] >= 0 === (side === "max") ? bounds.max.y : bounds.min.y)
          + matrix[8] * (matrix[8] >= 0 === (side === "max") ? bounds.max.z : bounds.min.z) + matrix[12];
        value = side === "min" ? Math.min(value, x) : Math.max(value, x);
      });
      return value;
    };
    return edge(world.rocks[0].visual, "min") - edge(world.train, "max");
  });
  expect(gap).toBeGreaterThan(0.3);
  const movement = await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    world.paused = true;
    world.rocks.forEach((rock: any) => { rock.state = "loading"; });
    const stopped = world.trainX;
    world.stepTrain(1 / 2);
    const whileLoading = world.trainX;
    world.rocks.forEach((rock: any) => { rock.state = "bed"; });
    world.stepTrain(1 / 2);
    return { stopped, whileLoading, afterLoading: world.trainX };
  });
  expect(movement.whileLoading).toBe(movement.stopped);
  expect(movement.afterLoading).toBeGreaterThan(movement.stopped);
});

test("locomotive wheels roll as the train leaves the station", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  const before = await wheelPose(page, "train", "Train_ROOT_Wheel_0_1");
  const carriageBefore = await wheelPose(page, "carriage", "Carriage_ROOT_Wheel_0_1");
  const rails = await page.evaluate(() => (window as any).__fleetWorld.rail.children
    .filter((mesh: any) => mesh.geometry?.parameters?.width === 28)
    .map((mesh: any) => ({ z: mesh.position.z, top: mesh.position.y + mesh.geometry.parameters.height / 2 })));
  for (const wheel of [before, carriageBefore]) {
    const nearest = rails.reduce((closest: any, rail: any) =>
      Math.abs(rail.z - wheel.center[2]) < Math.abs(closest.z - wheel.center[2]) ? rail : closest);
    expect(Math.abs(wheel.center[2] - nearest.z), JSON.stringify({ wheels: [before.center, carriageBefore.center], rails })).toBeLessThan(0.08);
    expect(Math.abs(wheel.center[1] - wheel.radius - nearest.top)).toBeLessThan(0.08);
  }
  await page.locator("#game-mount").focus();
  for (let index = 0; index < 3; index++) await page.keyboard.press("Space");
  const motion = await measureWheelTravel(page, "train", ["Train_ROOT_Wheel_0_1", "Carriage_ROOT_Wheel_0_1"]);
  const after = await wheelPose(page, "train", "Train_ROOT_Wheel_0_1");
  expect(axisDot(before.axis, after.axis)).toBeGreaterThan(0.995);
  for (const wheel of motion.wheels) {
    expect(Math.abs(wheel.angle * wheel.radius - motion.distance)).toBeLessThan(0.15);
  }
  expect(angleBetween(before.hubQuaternion, after.hubQuaternion)).toBeGreaterThan(0.3);
});

test("dump bed lifts around its authored hinge", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.locator("#game-mount").focus();
  for (let index = 0; index < 3; index++) await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.rocks.every((rock: any) => rock.state === "bed"))).toBe(true);
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.truckTarget), { timeout: 10_000 }).toBeUndefined();
  const before = await page.evaluate(() => {
    const vehicle = (window as any).__fleetWorld.truckModels.rocks;
    const pivot = vehicle.getObjectByName("Dump_Bed_Pivot");
    const floor = vehicle.getObjectByName("Dump_Bed_Floor");
    return {
      pivot: pivot.getWorldPosition(pivot.position.clone()).toArray(),
      floor: floor.getWorldPosition(floor.position.clone()).toArray(),
    };
  });
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.tilt)).toBeGreaterThan(0.8);
  const after = await page.evaluate(() => {
    const vehicle = (window as any).__fleetWorld.truckModels.rocks;
    const pivot = vehicle.getObjectByName("Dump_Bed_Pivot");
    const floor = vehicle.getObjectByName("Dump_Bed_Floor");
    return {
      pivot: pivot.getWorldPosition(pivot.position.clone()).toArray(),
      floor: floor.getWorldPosition(floor.position.clone()).toArray(),
    };
  });
  expect(Math.hypot(...before.pivot.map((value, index) => value - after.pivot[index]))).toBeLessThan(0.03);
  expect(after.floor[1] - before.floor[1]).toBeGreaterThan(0.15);
});

test("the whole mixer drum spins and cargo wheels roll across the bridge", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.getByRole("button", { name: "Bangun jembatan", exact: true }).click();
  const ringBefore = await page.evaluate(() => {
    const ring = (window as any).__fleetWorld.truckModels.build.getObjectByName("Mixer_Drum_Belly_Ring");
    return ring.getWorldQuaternion(ring.quaternion.clone()).toArray();
  });
  await page.waitForTimeout(500);
  const ringAfter = await page.evaluate(() => {
    const ring = (window as any).__fleetWorld.truckModels.build.getObjectByName("Mixer_Drum_Belly_Ring");
    return ring.getWorldQuaternion(ring.quaternion.clone()).toArray();
  });
  expect(angleBetween(ringBefore, ringAfter)).toBeGreaterThan(0.05);

  for (let index = 0; index < 3; index++) await tapModel(page, "form", index);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-bridge", "3", { timeout: 18_000 });
  const motion = await measureWheelTravel(page, "cargo", ["Cargo_Wheel_1"]);
  const wheel = motion.wheels[0];
  expect(Math.abs(wheel.angle * wheel.radius - motion.distance)).toBeLessThan(0.15);
});

test("stones leave the dump bed without jumping to a new position", async ({ page }) => {
  await startFreePlay(page);
  await attachWorld(page);
  await page.locator("#game-mount").focus();
  for (let index = 0; index < 3; index++) await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.rocks.every((rock: any) => rock.state === "bed"))).toBe(true);
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetWorld.truckTarget), { timeout: 10_000 }).toBeUndefined();
  await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    const original = world.stepRocks;
    world.stepRocks = function (dt: number) {
      const rock = this.rocks.find((item: any) => item.state === "bed");
      original.call(this, dt);
      if (rock?.state === "falling" && (window as any).__releaseJump === undefined) {
        const position = rock.body.translation();
        (window as any).__releaseJump = Math.hypot(
          position.x - rock.visual.position.x, position.y - 0.36 - rock.visual.position.y,
          position.z - rock.visual.position.z,
        );
      }
    };
  });
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__releaseJump)).toBeDefined();
  expect(await page.evaluate(() => (window as any).__releaseJump)).toBeLessThan(0.1);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered", "3", { timeout: 8_000 });
  await page.waitForTimeout(1800);
  const distances = await page.evaluate(() => {
    const world = (window as any).__fleetWorld;
    return world.rocks.filter((rock: any) => rock.state === "falling").map((rock: any) => {
      const position = rock.body.translation();
      return Math.hypot(position.x - world.pit.position.x, position.z - world.pit.position.z);
    });
  });
  expect(Math.max(...distances)).toBeLessThan(1.85);
});
