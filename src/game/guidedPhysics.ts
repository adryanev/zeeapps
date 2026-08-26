export type GuidedPoint = {
  x: number;
  y: number;
};

export type GuidedMotionState = {
  position: GuidedPoint;
  velocity: GuidedPoint;
};

export type GuidedMotionProfile = {
  acceleration: number;
  arrivalDistance: number;
  deceleration: number;
  maxSpeed: number;
  settlingSpeed: number;
};

export type GuidedMotionStep = {
  arrived: boolean;
  distance: number;
  velocity: GuidedPoint;
};

const NOMINAL_FRAME_MS = 1_000 / 60;
const MAX_FRAME_SCALE = 3;
const ARRIVAL_EPSILON = 0.001;

export function stepGuidedMotion(
  state: GuidedMotionState,
  target: GuidedPoint,
  profile: GuidedMotionProfile,
  deltaMs: number,
): GuidedMotionStep {
  const deltaScale = clamp(deltaMs / NOMINAL_FRAME_MS, 0, MAX_FRAME_SCALE);
  const offset = {
    x: target.x - state.position.x,
    y: target.y - state.position.y,
  };
  const distance = Math.hypot(offset.x, offset.y);
  const arrivalDistance = Math.max(profile.arrivalDistance, 0);
  const settlingSpeed = Math.max(profile.settlingSpeed, 0);

  if (distance <= arrivalDistance + ARRIVAL_EPSILON) {
    const velocity = approachZero(state.velocity, Math.max(profile.deceleration, 0) * deltaScale);
    return {
      arrived: Math.hypot(velocity.x, velocity.y) <= settlingSpeed,
      distance,
      velocity,
    };
  }

  const direction = {
    x: offset.x / distance,
    y: offset.y / distance,
  };
  const stoppingDistance = Math.max(distance - arrivalDistance, 0);
  const stoppingSpeed = Math.sqrt(2 * Math.max(profile.deceleration, 0) * stoppingDistance);
  const desiredSpeed = Math.min(Math.max(profile.maxSpeed, 0), stoppingSpeed);
  const desiredVelocity = {
    x: direction.x * desiredSpeed,
    y: direction.y * desiredSpeed,
  };
  let velocity = approachVector(
    state.velocity,
    desiredVelocity,
    Math.max(profile.acceleration, 0) * deltaScale,
  );

  const maxStepSpeed = stoppingDistance / Math.max(deltaScale, 1);
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed > maxStepSpeed && speed > 0) {
    const scale = maxStepSpeed / speed;
    velocity = { x: velocity.x * scale, y: velocity.y * scale };
  }

  return { arrived: false, distance, velocity };
}

function approachVector(current: GuidedPoint, target: GuidedPoint, maxChange: number): GuidedPoint {
  const change = {
    x: target.x - current.x,
    y: target.y - current.y,
  };
  const distance = Math.hypot(change.x, change.y);
  if (distance <= maxChange || maxChange === 0) {
    return maxChange === 0 ? { x: current.x, y: current.y } : { x: target.x, y: target.y };
  }

  const scale = maxChange / distance;
  return {
    x: current.x + change.x * scale,
    y: current.y + change.y * scale,
  };
}

function approachZero(current: GuidedPoint, maxChange: number): GuidedPoint {
  return approachVector(current, { x: 0, y: 0 }, maxChange);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
