import anchors from "./generated/vehicleAnchors.json" with { type: "json" };
import layout from "./generated/depotLayout.json" with { type: "json" };

export const FLEET = anchors;
export const DEPOT_LAYOUT = layout;
export type Point = { x: number; y: number };

/** Sample the projected Blender mesh; the background and path share coordinates. */
export function roadPoint(x: number, width: number, height: number): Point {
  const normalizedX = Math.max(layout.road[0].x, Math.min(layout.road.at(-1)!.x, x / width));
  const rightIndex = layout.road.findIndex(point => point.x >= normalizedX);
  const right = layout.road[Math.max(0, rightIndex)];
  const left = layout.road[Math.max(0, rightIndex - 1)];
  const t = right.x === left.x ? 0 : (normalizedX - left.x) / (right.x - left.x);
  return { x: normalizedX * width, y: (left.y + (right.y - left.y) * t) * height };
}

export function carriageOffset(index: number): Point {
  const gap = 6;
  const firstGap = -FLEET.train.couplerRear.x + FLEET.carriage.couplerFront.x + gap;
  const nextGap = -FLEET.carriage.couplerRear.x + FLEET.carriage.couplerFront.x + gap;
  return {
    x: -firstGap - nextGap * index,
    y: FLEET.train.railContact.y - FLEET.carriage.railContact.y,
  };
}

/** Signed rolling angle in radians, independent of display refresh rate. */
export function rollingAngle(distance: number, radius: number): number {
  return radius > 0 ? distance / radius : 0;
}
export type Bounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const TRUCK_GEOMETRY = {
  ...FLEET.cargo,
  bodyWidth: 180,
  bodyHeight: 108,
  wheelOffsets: FLEET.cargo.wheels,
  cargoWidth: 27,
  cargoHeight: 30,
  cargoOffsets: FLEET.cargo.cargoSlots,
  cargoBedBounds: { left: -58, right: 6, top: -61, bottom: -8 },
  cabBounds: { left: 9, right: 84, top: -43, bottom: 33 },
} as const;

export function boundsAround(
  center: { x: number; y: number },
  width: number,
  height: number,
): Bounds {
  return {
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: center.y - height / 2,
    bottom: center.y + height / 2,
  };
}

export function containsBounds(container: Bounds, item: Bounds): boolean {
  return (
    item.left >= container.left &&
    item.right <= container.right &&
    item.top >= container.top &&
    item.bottom <= container.bottom
  );
}

export function overlapsBounds(first: Bounds, second: Bounds): boolean {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}
