import { expect, test } from "@playwright/test";
import {
  boundsAround,
  containsBounds,
  overlapsBounds,
  TRUCK_GEOMETRY,
} from "../src/game/vehicleGeometry";

test.describe("Vehicle geometry", () => {
  test("keeps every cargo body inside the truck bed and outside the cab", () => {
    for (const offset of TRUCK_GEOMETRY.cargoOffsets) {
      const cargoBounds = boundsAround(
        offset,
        TRUCK_GEOMETRY.cargoWidth,
        TRUCK_GEOMETRY.cargoHeight,
      );

      expect(containsBounds(TRUCK_GEOMETRY.cargoBedBounds, cargoBounds)).toBe(true);
      expect(overlapsBounds(TRUCK_GEOMETRY.cabBounds, cargoBounds)).toBe(false);
    }
  });

  test("uses the same wheel and cargo coordinates as the rendered truck sprite", () => {
    for (const wheel of TRUCK_GEOMETRY.wheelOffsets) {
      expect(Math.abs(wheel.x) + TRUCK_GEOMETRY.wheelRadius).toBeLessThan(
        TRUCK_GEOMETRY.spriteWidth / 2,
      );
      expect(wheel.y + TRUCK_GEOMETRY.wheelRadius).toBeLessThan(
        TRUCK_GEOMETRY.spriteHeight / 2,
      );
    }
  });
});
