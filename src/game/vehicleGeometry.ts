export type Bounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const TRUCK_GEOMETRY = {
  bodyWidth: 220,
  bodyHeight: 76,
  spriteWidth: 248,
  spriteHeight: 115,
  wheelRadius: 18,
  wheelOffsets: [
    { x: -76, y: 35 },
    { x: 31, y: 35 },
  ],
  cargoWidth: 34,
  cargoHeight: 34,
  cargoOffsets: [
    { x: -72, y: -31 },
    { x: -35, y: -31 },
    { x: -53, y: -65 },
  ],
  cargoBedBounds: {
    left: -92,
    right: -15,
    top: -84,
    bottom: -10,
  },
  cabBounds: {
    left: -12,
    right: 112,
    top: -58,
    bottom: 43,
  },
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
