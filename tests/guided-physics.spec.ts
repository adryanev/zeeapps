import { expect, test } from "@playwright/test";
import { stepGuidedMotion, type GuidedMotionProfile, type GuidedMotionState } from "../src/game/guidedPhysics";

const profile: GuidedMotionProfile = {
  acceleration: 0.5,
  arrivalDistance: 4,
  deceleration: 0.5,
  maxSpeed: 4,
  settlingSpeed: 0.1,
};

function stepState(state: GuidedMotionState, target: { x: number; y: number }): ReturnType<typeof stepGuidedMotion> {
  const step = stepGuidedMotion(state, target, profile, 16.67);
  state.velocity = step.velocity;
  state.position = {
    x: state.position.x + step.velocity.x,
    y: state.position.y + step.velocity.y,
  };
  return step;
}

test.describe("Guided Physics", () => {
  test("accelerates from rest without a first-frame jump", () => {
    const state: GuidedMotionState = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    };

    const firstStep = stepGuidedMotion(state, { x: 100, y: 0 }, profile, 16.67);

    expect(firstStep.arrived).toBe(false);
    expect(firstStep.velocity.x).toBeGreaterThan(0);
    expect(firstStep.velocity.x).toBeLessThan(profile.maxSpeed);
    expect(firstStep.velocity.y).toBe(0);
  });

  test("caps speed, brakes before the target, and settles without overshooting", () => {
    const state: GuidedMotionState = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    };
    let peakSpeed = 0;
    let previousDistance = 100;
    let arrived = false;

    for (let index = 0; index < 120; index += 1) {
      const step = stepState(state, { x: 100, y: 0 });
      const speed = Math.hypot(state.velocity.x, state.velocity.y);
      const distance = Math.hypot(100 - state.position.x, -state.position.y);
      peakSpeed = Math.max(peakSpeed, speed);
      expect(distance).toBeLessThanOrEqual(previousDistance + 0.001);
      previousDistance = distance;
      arrived = step.arrived;
      if (arrived) {
        break;
      }
    }

    expect(peakSpeed).toBeLessThanOrEqual(profile.maxSpeed + 0.001);
    expect(arrived).toBe(true);
    expect(state.position.x).toBeLessThanOrEqual(100);
    expect(state.position.x).toBeGreaterThan(100 - profile.arrivalDistance - 0.01);
    expect(Math.hypot(state.velocity.x, state.velocity.y)).toBeLessThanOrEqual(profile.settlingSpeed + 0.001);
  });
});
