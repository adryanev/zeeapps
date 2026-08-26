import Phaser from "phaser";
import type { DepotTenangFeedback, DepotTenangState } from "./depotTenangTypes";
import { stepGuidedMotion, type GuidedMotionProfile } from "./guidedPhysics";

export type { DepotTenangFeedback, DepotTenangState } from "./depotTenangTypes";

/**
 * Equivalent Input normalizes keyboard and pointer actions into these Game intentions:
 * advance a Vehicle Journey, select a vehicle at its Resting Place, or optionally Soft Grab cargo.
 */
type GameIntention = "advance-vehicle-journey" | "select-resting-place" | "soft-grab";

type PointerDownIntention =
  | { type: "advance-vehicle-journey"; vehicle?: "truck" | "train" | "airplane" }
  | { type: "select-resting-place" }
  | { type: "soft-grab"; cargo: MatterJS.BodyType }
  | { type: "train-soft-grab"; trainBody: MatterJS.BodyType }
  | { type: "airplane-soft-grab" };

type DepotTenangCallbacks = {
  onStateChange: (state: DepotTenangState) => void;
  onFeedback?: (feedback: DepotTenangFeedback) => void;
  onActionAccepted?: () => void;
  onJourneyComplete?: (completedJourneys: number) => void;
  onPlayCycleComplete?: () => void;
  reducedMotion?: boolean;
};

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const ROAD_Y = 394;
const TRUCK_WIDTH = 138;
const TRUCK_HEIGHT = 52;
const TRUCK_MAX_SPEED = 6.4;
const CARGO_WIDTH = 34;
const CARGO_HEIGHT = 28;
const CARGO_MAX_SPEED = 7;
const CARGO_MAX_ANGULAR_SPEED = 0.14;
const CARGO_GRAB_RADIUS = 68;
const TRUCK_ARRIVAL_RATIO = 0.42;
const TRUCK_START_RATIO = 0.14;
const TRAIN_ARRIVAL_RATIO = 0.53;
const TRAIN_START_RATIO = 0.82;
const TRAIN_WIDTH = 92;
const TRAIN_HEIGHT = 34;
const TRAIN_CARRIAGE_WIDTH = 70;
const TRAIN_CARRIAGE_HEIGHT = 30;
const TRAIN_CARRIAGE_GAP = 82;
const TRAIN_SPEED = 5.2;
const TRAIN_MAX_SPEED = 6.2;
const TRAIN_MAX_ANGULAR_SPEED = 0.07;
const TRAIN_GRAB_RADIUS = 72;
const TRAIN_TRACK_MARGIN = 84;
const AIRPLANE_WIDTH = 112;
const AIRPLANE_HEIGHT = 42;
const AIRPLANE_SPEED = 3.8;
const AIRPLANE_FLIGHT_SPEED = 3.2;
const AIRPLANE_MAX_SPEED = 5;
const AIRPLANE_MAX_TILT = 0.32;
const AIRPLANE_GRAB_RADIUS = 88;
const AIRPLANE_GRAB_BOUNDS = {
  // Expand the visual bounds and sweep them along the guided flight path.
  halfWidth: AIRPLANE_WIDTH * 0.75,
  halfHeight: AIRPLANE_HEIGHT * 1.8,
} as const;
const TRUCK_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.48,
  arrivalDistance: 8,
  deceleration: 0.46,
  maxSpeed: TRUCK_MAX_SPEED,
  settlingSpeed: 0.08,
};
const TRUCK_RETURN_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.5,
  arrivalDistance: 8,
  deceleration: 0.42,
  maxSpeed: TRUCK_MAX_SPEED,
  settlingSpeed: 0.08,
};
const TRAIN_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.32,
  arrivalDistance: 8,
  deceleration: 0.36,
  maxSpeed: TRAIN_SPEED,
  settlingSpeed: 0.08,
};
const AIRPLANE_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.24,
  arrivalDistance: 8,
  deceleration: 0.32,
  maxSpeed: AIRPLANE_SPEED,
  settlingSpeed: 0.08,
};
const SOFT_GRAB_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.3,
  arrivalDistance: 5,
  deceleration: 0.42,
  maxSpeed: CARGO_MAX_SPEED,
  settlingSpeed: 0.08,
};
const CARGO_LOAD_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.32,
  arrivalDistance: 5,
  deceleration: 0.38,
  maxSpeed: CARGO_MAX_SPEED,
  settlingSpeed: 0.08,
};
const TRAIN_RECOVERY_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.2,
  arrivalDistance: 8,
  deceleration: 0.28,
  maxSpeed: 2.8,
  settlingSpeed: 0.08,
};
const TRUCK_RECOVERY_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.18,
  arrivalDistance: 8,
  deceleration: 0.24,
  maxSpeed: 2.4,
  settlingSpeed: 0.08,
};
const CARGO_RECOVERY_GUIDED_PROFILE: GuidedMotionProfile = {
  acceleration: 0.22,
  arrivalDistance: 8,
  deceleration: 0.3,
  maxSpeed: 2.6,
  settlingSpeed: 0.08,
};
/**
 * Each vehicle offers three calm activity beats: one for each cargo piece,
 * train body, or flight waypoint. Nine explorer-led beats at an unhurried
 * toddler pace provide the intended three-to-five-minute Play Cycle: the
 * calibration assumes about 20 seconds of looking, talking, or touching per
 * beat, before the authored vehicle movement is included. This is an
 * interaction-count assumption, not a countdown or a forced wait.
 */
const ACTIVITY_BEATS_PER_JOURNEY = 3;
const AIRPLANE_FLIGHT_MIN_Y_RATIO = 0.14;
const AIRPLANE_FLIGHT_MAX_Y_RATIO = 0.56;
const AIRPLANE_FLIGHT_MIN_X_RATIO = 0.2;
const AIRPLANE_FLIGHT_MAX_X_RATIO = 0.78;
const AIRPLANE_HANGAR_Y_RATIO = 0.55;
const RECOVERY_LOW_MOTION_DISTANCE = 0.75;
const RECOVERY_TARGET_DISTANCE = 18;
const RECOVERY_STUCK_TIMEOUT_MS = 1_800;
const RECOVERY_TARGET_CHANGE_DISTANCE = 8;
const TABLE_BACKGROUND_KEY = "depot-tenang-table-felt-bg";
const ROUTE_SURFACE_KEY = "depot-tenang-route-surface";
const TABLE_BACKGROUND_URL = `${import.meta.env.BASE_URL}assets/depot-tenang-v2/depot-tenang-table-felt-bg.png`;
const RASTER_TEXTURES = {
  truck: "depot-tenang-truck-body",
  train: "depot-tenang-train-body",
  airplane: "depot-tenang-airplane-body",
  garage: "depot-tenang-garage",
  station: "depot-tenang-station",
  hangar: "depot-tenang-hangar",
  wheel: "depot-tenang-wheel",
  propeller: "depot-tenang-propeller",
  contactShadow: "depot-tenang-contact-shadow",
  dust: "depot-tenang-dust",
  asphalt: "depot-tenang-asphalt",
  beech: "depot-tenang-beech",
  felt: "depot-tenang-felt",
} as const;
const RASTER_TEXTURE_URLS: Record<(typeof RASTER_TEXTURES)[keyof typeof RASTER_TEXTURES], string> = {
  [RASTER_TEXTURES.truck]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/truck-body.png`,
  [RASTER_TEXTURES.train]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/train-body.png`,
  [RASTER_TEXTURES.airplane]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/airplane-body.png`,
  [RASTER_TEXTURES.garage]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/garage-cutout.png`,
  [RASTER_TEXTURES.station]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/station-cutout.png`,
  [RASTER_TEXTURES.hangar]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/hangar-cutout.png`,
  [RASTER_TEXTURES.wheel]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/wheel-sprite.png`,
  [RASTER_TEXTURES.propeller]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/propeller-sprite.png`,
  [RASTER_TEXTURES.contactShadow]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/contact-shadow.png`,
  [RASTER_TEXTURES.dust]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/dust-puff.png`,
  [RASTER_TEXTURES.asphalt]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/asphalt-road-texture.png`,
  [RASTER_TEXTURES.beech]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/beech-wood-texture.png`,
  [RASTER_TEXTURES.felt]: `${import.meta.env.BASE_URL}assets/depot-tenang-v2/felt-terrain-texture.png`,
};
const COLORS = {
  sky: 0xd6b878,
  skyLight: 0xf2dfb2,
  hill: 0x6d894f,
  ground: 0xdbbf94,
  road: 0x5f5942,
  roadEdge: 0x25230c,
  rail: 0x4a402a,
  railMetal: 0xd8af4a,
  gold: 0xd8af4a,
  depot: 0xdbbf94,
  depotShadow: 0x917657,
  ink: 0x25230c,
  truck: 0xbe5a25,
  truckDark: 0x733218,
  truckWindow: 0xb7d4cf,
  wheel: 0x25230c,
  train: 0xd8af4a,
  trainDark: 0x6b4a25,
  trainWindow: 0xe2cf9d,
  carriage: 0x9b6b36,
  airplane: 0xdbbf94,
  airplaneDark: 0x8a4b2b,
  airplaneWindow: 0xa9c4b6,
  corridor: 0xead3a2,
};

type ActiveVehicle = "none" | "truck" | "train" | "airplane";
type TrainPhase = "ready" | "moving" | "station" | "returning" | "quiet";
type AirplanePhase = "ready" | "taking-off" | "flying" | "returning" | "quiet" | "recovering";
type ActivityVehicle = "truck" | "train" | "airplane";
type MotionWatch = {
  position: { x: number; y: number };
  target: { x: number; y: number };
  lowMotionSince: number;
};

export class DepotTenangScene extends Phaser.Scene {
  private readonly onStateChange: (state: DepotTenangState) => void;
  private readonly onFeedback?: (feedback: DepotTenangFeedback) => void;
  private readonly onActionAccepted?: () => void;
  private readonly onJourneyComplete?: (completedJourneys: number) => void;
  private readonly onPlayCycleComplete?: () => void;
  private readonly reducedMotion: boolean;
  private diorama?: Phaser.GameObjects.Graphics;
  private tableBackground?: Phaser.GameObjects.Image;
  private routeSurfaceVisual?: Phaser.GameObjects.Image;
  private routeSurfaceTexture?: Phaser.Textures.CanvasTexture;
  private garageVisual?: Phaser.GameObjects.Image;
  private stationVisual?: Phaser.GameObjects.Image;
  private hangarVisual?: Phaser.GameObjects.Image;
  private truckVisual?: Phaser.GameObjects.Container;
  private truckBody?: MatterJS.BodyType;
  private truckWheelVisuals: Phaser.GameObjects.Container[] = [];
  private truckAnticipationRemaining = 0;
  private truckSettleOffset = 0;
  private truckSettleVelocity = 0;
  private truckDustCooldown = 0;
  private trainVisual?: Phaser.GameObjects.Container;
  private trainBody?: MatterJS.BodyType;
  private trainCarriageBodies: MatterJS.BodyType[] = [];
  private trainCarriageVisuals = new Map<MatterJS.BodyType, Phaser.GameObjects.Container>();
  private trainWheelVisuals = new Map<Phaser.GameObjects.Container, Phaser.GameObjects.Container[]>();
  private trainConstraints: MatterJS.ConstraintType[] = [];
  private trainSwayFeedbackShown = false;
  private cargoBodies: MatterJS.BodyType[] = [];
  private cargoVisuals = new Map<MatterJS.BodyType, Phaser.GameObjects.Rectangle>();
  private cargoRecoveryTargets = new Map<MatterJS.BodyType, { x: number; y: number }>();
  private truckPhase: DepotTenangState = "ready";
  private trainPhase: TrainPhase = "ready";
  private activeVehicle: ActiveVehicle = "none";
  private grabbedCargo?: MatterJS.BodyType;
  private grabPointerId?: number;
  private grabTarget = { x: 0, y: 0 };
  private grabOffset = { x: 0, y: 0 };
  private grabStart = { x: 0, y: 0 };
  private grabStartedAt = 0;
  private activeTouchId?: number;
  private truckRecoveryTarget?: { x: number; y: number };
  private cargoRecoveryActive = false;
  private trainGrabbedBody?: MatterJS.BodyType;
  private trainGrabPointerId?: number;
  private trainGrabTarget = { x: 0, y: 0 };
  private trainGrabOffset = { x: 0, y: 0 };
  private trainGrabStart = { x: 0, y: 0 };
  private trainGrabStartedAt = 0;
  private trainRecoveryTargets = new Map<MatterJS.BodyType, { x: number; y: number }>();
  private trainRecoveryActive = false;
  private airplaneVisual?: Phaser.GameObjects.Container;
  private airplaneBody?: MatterJS.BodyType;
  private airplanePropeller?: Phaser.GameObjects.Container;
  private airplanePhase: AirplanePhase = "ready";
  private activityBeats: Record<ActivityVehicle, number> = {
    truck: 0,
    train: 0,
    airplane: 0,
  };
  private airplaneFlightTarget = { x: 0, y: 0 };
  private airplaneRecoveryTarget?: { x: number; y: number };
  private airplaneRecoveryResumePhase: AirplanePhase = "flying";
  private airplanePointerId?: number;
  private airplaneGrabTarget = { x: 0, y: 0 };
  private airplaneGrabOffset = { x: 0, y: 0 };
  private airplaneCorridorFeedbackShown = false;
  private completedJourneys = 0;
  private playCycleQuietEntered = false;
  private motionWatches = new Map<MatterJS.BodyType, MotionWatch>();
  private dustPuffs: Array<{
    visual: Phaser.GameObjects.Image;
    age: number;
    drift: number;
  }> = [];
  private visualClock = 0;
  private cameraFollowX = 0;
  private cameraFollowY = 0;
  private cameraOverscanX = 32;
  private cameraOverscanY = 18;

  public constructor(callbacks: DepotTenangCallbacks) {
    super({ key: "DepotTenangScene" });
    this.onStateChange = callbacks.onStateChange;
    this.onFeedback = callbacks.onFeedback;
    this.onActionAccepted = callbacks.onActionAccepted;
    this.onJourneyComplete = callbacks.onJourneyComplete;
    this.onPlayCycleComplete = callbacks.onPlayCycleComplete;
    this.reducedMotion = callbacks.reducedMotion ?? false;
  }

  public preload(): void {
    this.load.image(TABLE_BACKGROUND_KEY, TABLE_BACKGROUND_URL);
    for (const [key, url] of Object.entries(RASTER_TEXTURE_URLS)) {
      this.load.image(key, url);
    }
  }

  private createRasterImage(
    key: (typeof RASTER_TEXTURES)[keyof typeof RASTER_TEXTURES],
    width: number,
    height: number,
  ): Phaser.GameObjects.Image {
    return this.add.image(0, 0, key).setDisplaySize(width, height);
  }

  private createTexturedRoute(): void {
    this.routeSurfaceTexture = this.textures.createCanvas(ROUTE_SURFACE_KEY, 1, 1) ?? undefined;
    this.routeSurfaceVisual = this.add
      .image(0, 0, ROUTE_SURFACE_KEY)
      .setOrigin(0, 0)
      .setDepth(-15);
  }

  public create(): void {
    this.tableBackground = this.add.image(0, 0, TABLE_BACKGROUND_KEY).setOrigin(0, 0).setDepth(-20);
    this.createTexturedRoute();
    this.diorama = this.add.graphics();
    this.diorama.setDepth(-10);
    this.createMatterBounds();
    this.createTruck();
    this.createTrain();
    this.createAirplane();
    this.garageVisual = this.createRasterImage(RASTER_TEXTURES.garage, 184, 126).setDepth(2);
    this.stationVisual = this.createRasterImage(RASTER_TEXTURES.station, 166, 132).setDepth(2).setAlpha(0.94);
    this.hangarVisual = this.createRasterImage(RASTER_TEXTURES.hangar, 174, 124).setDepth(2).setAlpha(0.94);
    this.layoutDiorama();

    this.cameraFollowX = this.cameras.main.scrollX;
    this.cameraFollowY = this.cameras.main.scrollY;

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);
    this.input.keyboard?.on("keydown", this.handleKeyboard, this);
    this.input.keyboard?.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
    this.scale.on("resize", this.handleResize, this);

    this.onStateChange("ready");
  }

  public update(_time?: number, delta = 16.67): void {
    if (!this.truckBody || !this.truckVisual) {
      return;
    }

    const deltaMs = this.clamp(delta || 16.67, 0, 120);
    this.visualClock += deltaMs;
    this.updateTruckSafety(deltaMs);
    this.updateCargoSafety(deltaMs);
    this.updateGrabbedCargo(deltaMs);
    const truckReachedDestination = this.updateTruckJourneyMovement(deltaMs);
    this.updateTrainSafety(deltaMs);
    this.updateGrabbedTrain(deltaMs);
    this.updateTrainConstraintFeedback();
    const trainReachedDestination = this.updateTrainJourneyMovement(deltaMs);
    this.updateAirplaneSafety(deltaMs);
    this.updateAirplaneGrabbed();
    this.updateAirplaneJourneyMovement(deltaMs);
    this.updateAirplaneCorridorFeedback();
    this.updateTruckStuckDetection();
    this.updateCargoStuckDetection();
    this.updateTrainStuckDetection();
    this.updateAirplaneStuckDetection();

    if (this.truckPhase === "moving" && truckReachedDestination) {
      this.settleTruckAtArrival();
    }

    if (this.truckPhase === "returning" && truckReachedDestination) {
      this.settleTruckAtGarage();
    }

    if (this.trainPhase === "moving" && trainReachedDestination) {
      this.settleTrainAtStation();
    }

    if (this.trainPhase === "returning" && trainReachedDestination) {
      this.settleTrainAtDepot();
    }

    if (this.truckPhase === "returning" || this.truckPhase === "quiet") {
      this.syncLoadedCargo(deltaMs);
    }

    this.updateCargoVisuals();
    this.updateTruckVisual(deltaMs);
    this.updateTrainVisuals(deltaMs);
    this.updateAirplaneVisual(deltaMs);
    this.updateDustPuffs(deltaMs);
    this.updateCameraFollow(deltaMs);
  }

  private updateTruckVisual(deltaMs: number): void {
    if (!this.truckBody || !this.truckVisual) {
      return;
    }

    const frameScale = deltaMs / 16.67;
    const speed = Math.hypot(this.truckBody.velocity.x, this.truckBody.velocity.y);
    this.truckAnticipationRemaining = Math.max(0, this.truckAnticipationRemaining - deltaMs);
    const anticipationRatio = this.reducedMotion
      ? Math.min(this.truckAnticipationRemaining / 90, 1)
      : Math.min(this.truckAnticipationRemaining / 220, 1);
    const settleAcceleration = -this.truckSettleOffset * 0.14 - this.truckSettleVelocity * 0.24;
    this.truckSettleVelocity += settleAcceleration * frameScale;
    this.truckSettleOffset += this.truckSettleVelocity * frameScale;
    if (Math.abs(this.truckSettleOffset) < 0.02 && Math.abs(this.truckSettleVelocity) < 0.02) {
      this.truckSettleOffset = 0;
      this.truckSettleVelocity = 0;
    }

    const anticipationLean = this.reducedMotion ? -0.018 : -0.045;
    const squash = 1 - anticipationRatio * (this.reducedMotion ? 0.025 : 0.06);
    const activeScale = this.activeVehicle === "truck" ? this.getActiveVehicleVisualScale() : 0.82;
    this.truckVisual
      .setPosition(this.truckBody.position.x, this.truckBody.position.y + this.truckSettleOffset)
      .setRotation(this.truckBody.angle * (this.reducedMotion ? 0.08 : 0.16) + anticipationLean * anticipationRatio)
      .setScale(activeScale, activeScale * squash);
    this.truckVisual.setAlpha(this.activeVehicle === "truck" ? 1 : 0.72);

    for (const wheel of this.truckWheelVisuals) {
      wheel.rotation += this.truckBody.velocity.x * 0.035 * frameScale;
    }

    this.truckDustCooldown = Math.max(0, this.truckDustCooldown - deltaMs);
    if (!this.reducedMotion && speed > 1.1 && this.truckDustCooldown === 0) {
      this.emitDustPuff();
      this.truckDustCooldown = 150;
    }
  }

  private emitDustPuff(): void {
    if (!this.truckBody || this.reducedMotion) {
      return;
    }

    const visual = this.createRasterImage(RASTER_TEXTURES.dust, 86, 19)
      .setPosition(this.truckBody.position.x - 92, this.truckBody.position.y + 42)
      .setDepth(8)
      .setAlpha(0.48);
    this.dustPuffs.push({ visual, age: 0, drift: 8 + Math.random() * 8 });
    if (this.dustPuffs.length > 5) {
      this.dustPuffs.shift()?.visual.destroy();
    }
  }

  private updateDustPuffs(deltaMs: number): void {
    for (let index = this.dustPuffs.length - 1; index >= 0; index -= 1) {
      const puff = this.dustPuffs[index];
      puff.age += deltaMs;
      const progress = this.clamp(puff.age / 520, 0, 1);
      puff.visual.x -= puff.drift * (deltaMs / 1000);
      puff.visual.y -= 5 * (deltaMs / 1000);
      puff.visual.setAlpha((1 - progress) * 0.48).setScale(0.8 + progress * 0.35);
      if (progress >= 1) {
        puff.visual.destroy();
        this.dustPuffs.splice(index, 1);
      }
    }
  }

  private updateCameraFollow(deltaMs: number): void {
    const camera = this.cameras.main;
    const width = this.getWorldWidth();
    const height = this.getWorldHeight();
    const viewportWidth = this.scale.width;
    const viewportHeight = this.scale.height;
    let targetX = 0;
    let targetY = 0;
    const activeBody =
      this.activeVehicle === "truck" && (this.truckPhase === "moving" || this.truckPhase === "returning")
        ? this.truckBody
        : this.activeVehicle === "train" && (this.trainPhase === "moving" || this.trainPhase === "returning")
          ? this.trainBody
          : this.activeVehicle === "airplane" && this.isAirplaneJourneyActive()
            ? this.airplaneBody
            : undefined;

    if (!this.reducedMotion && activeBody) {
      const verticalFocusRatio =
        this.activeVehicle === "airplane" ? 0.32 : viewportHeight < 480 ? 0.4 : 0.52;
      targetX = this.clamp(
        activeBody.position.x - viewportWidth * 0.36,
        -this.cameraOverscanX,
        Math.max(this.cameraOverscanX, width - viewportWidth + this.cameraOverscanX),
      );
      targetY = this.clamp(
        activeBody.position.y - viewportHeight * verticalFocusRatio,
        -this.cameraOverscanY,
        Math.max(this.cameraOverscanY, height - viewportHeight + this.cameraOverscanY),
      );
    }

    if (!activeBody || this.reducedMotion) {
      this.cameraFollowX = targetX;
      this.cameraFollowY = targetY;
      camera.setScroll(this.cameraFollowX, this.cameraFollowY);
      return;
    }

    const easing = this.reducedMotion ? 1 : 1 - Math.pow(0.9, deltaMs / 16.67);
    this.cameraFollowX += (targetX - this.cameraFollowX) * easing;
    this.cameraFollowY += (targetY - this.cameraFollowY) * easing;
    camera.setScroll(this.cameraFollowX, this.cameraFollowY);
  }

  private updateTruckJourneyMovement(deltaMs: number): boolean {
    if (
      !this.truckBody ||
      this.activeVehicle !== "truck" ||
      this.truckRecoveryTarget ||
      (this.truckPhase !== "moving" && this.truckPhase !== "returning")
    ) {
      return false;
    }

    const destination =
      this.truckPhase === "moving" ? this.getTruckArrivalPoint() : this.getTruckStartingPoint();
    const profile = this.truckPhase === "moving" ? TRUCK_GUIDED_PROFILE : TRUCK_RETURN_GUIDED_PROFILE;
    const step = stepGuidedMotion(
      {
        position: this.truckBody.position,
        velocity: this.truckBody.velocity,
      },
      destination,
      profile,
      deltaMs,
    );
    this.wakeBody(this.truckBody);
    this.matter.body.setVelocity(this.truckBody, step.velocity);
    this.dampenAngularVelocity(this.truckBody, 0.04);
    return step.arrived;
  }

  private updateTrainJourneyMovement(deltaMs: number): boolean {
    if (
      !this.trainBody ||
      this.activeVehicle !== "train" ||
      this.trainRecoveryActive ||
      (this.trainPhase !== "moving" && this.trainPhase !== "returning")
    ) {
      return false;
    }

    const destination =
      this.trainPhase === "moving" ? this.getTrainArrivalPoint() : this.getTrainStartingPoint();
    const step = stepGuidedMotion(
      {
        position: this.trainBody.position,
        velocity: this.trainBody.velocity,
      },
      destination,
      TRAIN_GUIDED_PROFILE,
      deltaMs,
    );
    this.wakeTrainBodies();
    for (const trainBody of this.getTrainBodies()) {
      this.matter.body.setVelocity(trainBody, step.velocity);
      this.dampenAngularVelocity(trainBody, TRAIN_MAX_ANGULAR_SPEED);
    }
    return step.arrived;
  }

  private createMatterBounds(): void {
    const ground = this.matter.add.rectangle(
      this.getWorldWidth() / 2,
      ROAD_Y + 20,
      this.getWorldWidth(),
      40,
      {
        isStatic: true,
        label: "depot-road",
      },
    );
    ground.friction = 0.9;

    this.matter.add.rectangle(-24, this.getWorldHeight() / 2, 48, this.getWorldHeight() * 2, {
      isStatic: true,
      label: "depot-left-bound",
    });
    this.matter.add.rectangle(
      this.getWorldWidth() + 24,
      this.getWorldHeight() / 2,
      48,
      this.getWorldHeight() * 2,
      {
        isStatic: true,
        label: "depot-right-bound",
      },
    );

    const railY = this.getTrainRailY();
    const upperTrackBound = this.matter.add.rectangle(
      this.getWorldWidth() / 2,
      railY - TRAIN_TRACK_MARGIN,
      this.getWorldWidth(),
      24,
      {
        isStatic: true,
        label: "depot-rail-upper-bound",
      },
    );
    const lowerTrackBound = this.matter.add.rectangle(
      this.getWorldWidth() / 2,
      railY + TRAIN_TRACK_MARGIN,
      this.getWorldWidth(),
      24,
      {
        isStatic: true,
        label: "depot-rail-lower-bound",
      },
    );
    upperTrackBound.friction = 0.8;
    lowerTrackBound.friction = 0.8;
  }

  private createTruck(): void {
    const startingPoint = this.getTruckStartingPoint();
    this.truckBody = this.matter.add.rectangle(startingPoint.x, startingPoint.y, TRUCK_WIDTH, TRUCK_HEIGHT, {
      chamfer: { radius: 8 },
      density: 0.001,
      friction: 0,
      frictionAir: 0.03,
      restitution: 0.05,
      ignoreGravity: true,
      label: "active-truck",
    });

    this.truckVisual = this.add.container(startingPoint.x, startingPoint.y);
    this.truckVisual.setDepth(10);
    const rearWheel = this.createWheelVisual(18);
    const frontWheel = this.createWheelVisual(18);
    rearWheel.setPosition(-66, 40);
    frontWheel.setPosition(66, 40);
    this.truckWheelVisuals = [rearWheel, frontWheel];
    const bodyImage = this.createRasterImage(RASTER_TEXTURES.truck, 282, 151);
    bodyImage.setPosition(0, -5);
    const contactShadow = this.createRasterImage(RASTER_TEXTURES.contactShadow, 236, 33);
    contactShadow.setPosition(-4, 50).setAlpha(0.6);
    this.truckVisual.add([
      contactShadow,
      bodyImage,
      rearWheel,
      frontWheel,
    ]);
  }

  private createWheelVisual(radius: number): Phaser.GameObjects.Container {
    const wheel = this.add.container(0, 0);
    wheel.add(this.createRasterImage(RASTER_TEXTURES.wheel, radius * 2.45, radius * 2.45));
    return wheel;
  }

  private createTrain(): void {
    const startingPoint = this.getTrainStartingPoint();
    this.trainBody = this.matter.add.rectangle(
      startingPoint.x,
      startingPoint.y,
      TRAIN_WIDTH,
      TRAIN_HEIGHT,
      {
        chamfer: { radius: 8 },
        density: 0.001,
        friction: 0,
        frictionAir: 0.03,
        restitution: 0.02,
        ignoreGravity: true,
        collisionFilter: { group: -2 },
        label: "active-train",
      },
    );

    this.trainVisual = this.add.container(startingPoint.x, startingPoint.y);
    this.trainVisual.setDepth(9);
    const locomotiveRearWheel = this.createWheelVisual(11);
    const locomotiveFrontWheel = this.createWheelVisual(11);
    locomotiveRearWheel.setPosition(-34, 43);
    locomotiveFrontWheel.setPosition(34, 43);
    this.trainWheelVisuals.set(this.trainVisual, [locomotiveRearWheel, locomotiveFrontWheel]);
    const bodyImage = this.createRasterImage(RASTER_TEXTURES.train, 330, 127);
    const contactShadow = this.createRasterImage(RASTER_TEXTURES.contactShadow, 130, 19);
    contactShadow.setPosition(0, 50).setAlpha(0.42);
    this.trainVisual.add([
      contactShadow,
      bodyImage,
      locomotiveRearWheel,
      locomotiveFrontWheel,
    ]);

    const carriageOffsets = [-TRAIN_CARRIAGE_GAP, -TRAIN_CARRIAGE_GAP * 2];
    for (const [index, offset] of carriageOffsets.entries()) {
      const body = this.matter.add.rectangle(
        startingPoint.x + offset,
        startingPoint.y,
        TRAIN_CARRIAGE_WIDTH,
        TRAIN_CARRIAGE_HEIGHT,
        {
          chamfer: { radius: 7 },
          density: 0.0008,
          friction: 0,
          frictionAir: 0.03,
          restitution: 0.02,
          ignoreGravity: true,
          collisionFilter: { group: -2 },
          label: `train-carriage-${index + 1}`,
        },
      );
      const visual = this.createTrainCarriageVisual(index);
      visual.setPosition(body.position.x, body.position.y);
      this.trainCarriageBodies.push(body);
      this.trainCarriageVisuals.set(body, visual);
    }

    const [firstCarriage, secondCarriage] = this.trainCarriageBodies;
    if (firstCarriage) {
      this.trainConstraints.push(
        this.matter.add.constraint(this.trainBody, firstCarriage, TRAIN_CARRIAGE_GAP, 0.14, {
          damping: 0.16,
          label: "train-locomotive-constraint",
        }),
      );
    }
    if (firstCarriage && secondCarriage) {
      this.trainConstraints.push(
        this.matter.add.constraint(firstCarriage, secondCarriage, TRAIN_CARRIAGE_GAP, 0.14, {
          damping: 0.16,
          label: "train-carriage-constraint",
        }),
      );
    }
  }

  private createAirplane(): void {
    const restingPoint = this.getAirplaneHangarPoint();
    this.airplaneBody = this.matter.add.rectangle(
      restingPoint.x,
      restingPoint.y,
      AIRPLANE_WIDTH,
      AIRPLANE_HEIGHT,
      {
        chamfer: { radius: 12 },
        density: 0.001,
        friction: 0,
        frictionAir: 0.05,
        restitution: 0,
        ignoreGravity: true,
        collisionFilter: { mask: 0 },
        label: "active-airplane",
      },
    );

    this.airplaneVisual = this.add.container(restingPoint.x, restingPoint.y);
    this.airplaneVisual.setDepth(10);
    this.airplanePropeller = this.createPropellerVisual();
    this.airplanePropeller.setPosition(108, 4);
    const bodyImage = this.createRasterImage(RASTER_TEXTURES.airplane, 230, 134);
    const contactShadow = this.createRasterImage(RASTER_TEXTURES.contactShadow, 148, 20);
    contactShadow.setPosition(0, 32).setAlpha(0.42);
    this.airplaneVisual.add([
      contactShadow,
      bodyImage,
      this.airplanePropeller,
    ]);
  }

  private createPropellerVisual(): Phaser.GameObjects.Container {
    const propeller = this.add.container(0, 0);
    propeller.add(this.createRasterImage(RASTER_TEXTURES.propeller, 42, 42));
    return propeller;
  }

  private createTrainCarriageVisual(_index: number): Phaser.GameObjects.Container {
    const visual = this.add.container(0, 0);
    visual.setDepth(9);
    const rearWheel = this.createWheelVisual(9);
    const frontWheel = this.createWheelVisual(9);
    rearWheel.setPosition(-22, 43);
    frontWheel.setPosition(22, 43);
    this.trainWheelVisuals.set(visual, [rearWheel, frontWheel]);
    const contactShadow = this.createRasterImage(RASTER_TEXTURES.contactShadow, 88, 13);
    contactShadow.setPosition(0, 50).setAlpha(0.34);
    visual.add([contactShadow, rearWheel, frontWheel]);
    return visual;
  }

  private createCargo(): void {
    this.clearCargo();

    const arrivalPoint = this.getTruckArrivalPoint();
    const cargoDefinitions = [
      { x: arrivalPoint.x - 26, y: ROAD_Y - 108, color: 0xe7b75b },
      { x: arrivalPoint.x + 14, y: ROAD_Y - 108, color: 0x7ba8a3 },
      { x: arrivalPoint.x - 6, y: ROAD_Y - 150, color: 0xd77a61 },
    ];

    for (const [index, definition] of cargoDefinitions.entries()) {
      const body = this.matter.add.rectangle(definition.x, definition.y, CARGO_WIDTH, CARGO_HEIGHT, {
        chamfer: { radius: 5 },
        density: 0.001,
        friction: 0.2,
        frictionAir: 0.08,
        restitution: 0.05,
        label: `truck-cargo-${index + 1}`,
      });
      const visual = this.add.rectangle(0, 0, CARGO_WIDTH, CARGO_HEIGHT, definition.color);
      visual.setStrokeStyle(3, COLORS.ink, 0.55);
      visual.setDepth(11);
      this.cargoBodies.push(body);
      this.cargoVisuals.set(body, visual);
    }
  }

  private layoutDiorama(): void {
    if (!this.diorama) {
      return;
    }

    const width = this.getWorldWidth();
    const height = this.getWorldHeight();
    const roadY = Math.min(ROAD_Y, height * 0.75);
    const railY = roadY - 96;
    this.cameraOverscanX = Math.max(96, width * 0.24);
    this.cameraOverscanY = Math.max(24, height * 0.12);
    this.tableBackground
      ?.setPosition(-this.cameraOverscanX, -this.cameraOverscanY)
      .setDisplaySize(width + this.cameraOverscanX * 2, height + this.cameraOverscanY * 2)
      .setDepth(-20);
    this.cameras.main.setBounds(
      -this.cameraOverscanX,
      -this.cameraOverscanY,
      width + this.cameraOverscanX * 2,
      height + this.cameraOverscanY * 2,
    );

    this.diorama.clear();
    this.layoutTexturedRoute(width, height, roadY);
    this.drawHangar(width * 0.83, railY - 55);
    this.drawStation(width * 0.57, railY - 38);
    this.drawGarage(width * 0.13, roadY - 58);

    const depthScale = this.clamp(0.92 + (width - WORLD_WIDTH) / 5_000, 0.92, 1.06);
    this.garageVisual
      ?.setPosition(width * 0.13, roadY + 5)
      .setDisplaySize(184 * depthScale, 139 * depthScale)
      .setAlpha(0.76);
    this.stationVisual
      ?.setPosition(width * 0.57, railY + 10)
      .setDisplaySize(166 * depthScale, 132 * depthScale)
      .setAlpha(0.68);
    const airplaneHangarPoint = this.getAirplaneHangarPoint();
    this.hangarVisual
      ?.setPosition(airplaneHangarPoint.x, airplaneHangarPoint.y + 30)
      .setDisplaySize(174 * depthScale, 124 * depthScale)
      .setAlpha(0.68);
  }

  private layoutTexturedRoute(width: number, height: number, roadY: number): void {
    const overscanWidth = width + this.cameraOverscanX * 2;
    const overscanHeight = height + this.cameraOverscanY * 2;
    const texture = this.routeSurfaceTexture;
    if (!texture) {
      return;
    }

    texture.setSize(Math.ceil(overscanWidth), Math.ceil(overscanHeight));
    const context = texture.context;
    context.clearRect(0, 0, texture.width, texture.height);
    context.save();
    context.translate(this.cameraOverscanX, this.cameraOverscanY);

    const feltPattern = context.createPattern(
      this.textures.get(RASTER_TEXTURES.felt).getSourceImage() as CanvasImageSource,
      "repeat",
    );
    if (feltPattern) {
      context.save();
      context.globalAlpha = 0.18;
      context.fillStyle = feltPattern;
      context.beginPath();
      context.ellipse(width * 0.2, height * 0.24, width * 0.17, height * 0.15, 0, 0, Math.PI * 2);
      context.ellipse(width * 0.76, height * 0.74, width * 0.21, height * 0.17, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    const route = this.createRoutePoints(width, roadY);
    const roadWidth = this.clamp(Math.min(width, height) * 0.24, 118, 188);
    const drawRoutePath = (): void => {
      context.beginPath();
      context.moveTo(route[0].x, route[0].y);
      for (const point of route.slice(1)) {
        context.lineTo(point.x, point.y);
      }
    };

    const beechPattern = context.createPattern(
      this.textures.get(RASTER_TEXTURES.beech).getSourceImage() as CanvasImageSource,
      "repeat",
    );
    if (beechPattern) {
      drawRoutePath();
      context.strokeStyle = beechPattern;
      context.lineWidth = roadWidth + 42;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
    }

    const asphaltPattern = context.createPattern(
      this.textures.get(RASTER_TEXTURES.asphalt).getSourceImage() as CanvasImageSource,
      "repeat",
    );
    if (asphaltPattern) {
      drawRoutePath();
      context.strokeStyle = asphaltPattern;
      context.lineWidth = roadWidth;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
    }

    drawRoutePath();
    context.strokeStyle = "rgba(246, 224, 170, 0.84)";
    context.lineWidth = 7;
    context.setLineDash([34, 30]);
    context.lineDashOffset = 4;
    context.stroke();
    context.setLineDash([]);
    context.restore();

    texture.refresh();
    this.routeSurfaceVisual
      ?.setPosition(-this.cameraOverscanX, -this.cameraOverscanY)
      .setDisplaySize(overscanWidth, overscanHeight);
  }

  private createRoutePoints(width: number, roadY: number): Phaser.Math.Vector2[] {
    const hangar = this.getAirplaneHangarPoint();
    const first = this.sampleQuadraticRoute(
      { x: -this.cameraOverscanX - 90, y: roadY + 148 },
      { x: width * 0.18, y: roadY - 58 },
      { x: width * 0.47, y: roadY - 8 },
    );
    const second = this.sampleQuadraticRoute(
      first[first.length - 1],
      { x: width * 0.68, y: roadY + 94 },
      { x: hangar.x + 38, y: hangar.y + 44 },
    );
    return [...first, ...second.slice(1)];
  }

  private sampleQuadraticRoute(
    start: { x: number; y: number },
    control: { x: number; y: number },
    end: { x: number; y: number },
    samples = 28,
  ): Phaser.Math.Vector2[] {
    return Array.from({ length: samples + 1 }, (_, index) => {
      const progress = index / samples;
      const inverse = 1 - progress;
      return new Phaser.Math.Vector2(
        inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
        inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
      );
    });
  }

  private drawGarage(x: number, y: number): void {
    this.diorama?.fillStyle(COLORS.ink, 0.2).fillEllipse(x + 4, y + 84, 174, 28);
  }

  private drawStation(x: number, y: number): void {
    this.diorama?.fillStyle(COLORS.ink, 0.14).fillEllipse(x, y + 72, 164, 22);
  }

  private drawHangar(x: number, y: number): void {
    this.diorama?.fillStyle(COLORS.ink, 0.12).fillEllipse(x, y + 82, 176, 24);
  }

  private handleResize(): void {
    this.layoutDiorama();
  }

  private normalizeKeyboardIntent(event: KeyboardEvent): GameIntention | undefined {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return undefined;
    }

    if (
      !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Enter", " ", "Space", "Spacebar"].includes(
        event.key,
      )
    ) {
      return undefined;
    }

    return "advance-vehicle-journey";
  }

  private handleKeyboard(event: KeyboardEvent): void {
    const intention = this.normalizeKeyboardIntent(event);
    if (intention === "advance-vehicle-journey") {
      this.advanceJourney(event.key);
    }
  }

  private normalizePointerDownIntent(pointer: Phaser.Input.Pointer): PointerDownIntention {
    const { x, y } = this.getPointerWorldPosition(pointer);
    if (this.activeVehicle === "airplane") {
      if (
        this.airplanePhase === "flying" &&
        (this.findAirplaneAt(x, y) || this.isAtAirplaneFollowFocus(pointer))
      ) {
        return { type: "airplane-soft-grab" };
      }

      return { type: "advance-vehicle-journey" };
    }

    if (this.activeVehicle === "train") {
      const trainBody = this.findTrainBodyAt(x, y);
      if (trainBody && this.trainPhase !== "quiet") {
        return { type: "train-soft-grab", trainBody };
      }

      return { type: "advance-vehicle-journey" };
    }

    if (this.activeVehicle === "none") {
      const trainRestingPoint = this.getTrainStartingPoint();
      const airplaneRestingPoint = this.getAirplaneHangarPoint();
      const pointerPrefersTrain =
        x <= (trainRestingPoint.x + airplaneRestingPoint.x) / 2 &&
        (this.isTouchPointer(pointer)
          ? this.isAtTrainRestingPlace(x, y)
          : this.findTrainBodyAt(x, y));

      if (this.trainPhase === "ready" && pointerPrefersTrain) {
        return { type: "advance-vehicle-journey", vehicle: "train" };
      }

      if (
        this.airplanePhase === "ready" &&
        (this.truckPhase === "ready" || this.truckPhase === "quiet") &&
        (this.isTouchPointer(pointer)
          ? this.isAtAirplaneRestingPlace(x, y)
          : this.isNearAirplaneRestingPlace(x, y))
      ) {
        return { type: "advance-vehicle-journey", vehicle: "airplane" };
      }
    }

    if (this.truckPhase === "cargo") {
      const cargo = this.findCargoAt(x, y);
      if (cargo) {
        return { type: "soft-grab", cargo };
      }
    }

    if (this.truckPhase === "ready" && this.isAtTruckRestingPlace(x, y)) {
      return { type: "select-resting-place" };
    }

    return { type: "advance-vehicle-journey" };
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.claimTouch(pointer)) {
      return;
    }

    if (
      this.grabbedCargo ||
      this.cargoRecoveryActive ||
      this.truckRecoveryTarget ||
      this.trainGrabbedBody ||
      this.trainRecoveryActive ||
      this.airplanePointerId !== undefined ||
      this.airplaneRecoveryTarget
    ) {
      return;
    }

    const intention = this.normalizePointerDownIntent(pointer);
    if (intention.type === "soft-grab") {
      this.beginCargoGrab(intention.cargo, pointer);
      return;
    }

    if (intention.type === "train-soft-grab") {
      this.beginTrainGrab(intention.trainBody, pointer);
      return;
    }

    if (intention.type === "airplane-soft-grab") {
      this.beginAirplaneGrab(pointer);
      return;
    }

    if (intention.type === "select-resting-place") {
      this.onFeedback?.("vehicle-selected");
      return;
    }

    this.advanceJourney("", intention.vehicle);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isTouchPointer(pointer) && this.activeTouchId !== pointer.id) {
      return;
    }

    if (this.isPointerNearStageEdge(pointer)) {
      if (this.grabbedCargo && this.grabPointerId === pointer.id) {
        this.beginCargoRecovery(this.grabbedCargo);
        return;
      }
      if (this.trainGrabbedBody && this.trainGrabPointerId === pointer.id) {
        this.beginTrainRecovery();
        return;
      }
      if (
        this.airplanePointerId === pointer.id ||
        (pointer.isDown && this.activeVehicle === "airplane" && this.airplanePhase === "flying")
      ) {
        this.beginAirplaneRecovery();
        return;
      }
    }

    const { x, y } = this.getPointerWorldPosition(pointer);
    if (this.grabbedCargo && this.grabPointerId === pointer.id) {
      this.grabTarget.x = x - this.grabOffset.x;
      this.grabTarget.y = y - this.grabOffset.y;
      this.resetMotionWatch(this.grabbedCargo, this.grabTarget);
      return;
    }

    if (this.trainGrabbedBody && this.trainGrabPointerId === pointer.id) {
      this.trainGrabTarget.x = x - this.trainGrabOffset.x;
      this.trainGrabTarget.y = y - this.trainGrabOffset.y;
      this.resetMotionWatch(this.trainGrabbedBody, this.trainGrabTarget);
      return;
    }

    if (this.airplanePointerId === pointer.id) {
      if (this.isPointerNearStageEdge(pointer)) {
        this.beginAirplaneRecovery();
        return;
      }
      this.airplaneGrabTarget.x = x - this.airplaneGrabOffset.x;
      this.airplaneGrabTarget.y = y - this.airplaneGrabOffset.y;
      if (this.airplaneBody) {
        this.resetMotionWatch(this.airplaneBody, this.airplaneGrabTarget);
      }
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.isTouchPointer(pointer)) {
      if (this.activeTouchId !== pointer.id) {
        return;
      }

      this.activeTouchId = undefined;
    }

    const { x, y } = this.getPointerWorldPosition(pointer);
    if (this.grabbedCargo && this.grabPointerId === pointer.id) {
      const releasedCargo = this.grabbedCargo;
      const elapsed = Math.max(this.time.now - this.grabStartedAt, 1);
      const impulseScale = this.getPhysicsImpulseScale();
      const swipeVelocity = {
        x: this.clamp(
          (x - this.grabStart.x) / elapsed * 8 * impulseScale,
          -CARGO_MAX_SPEED,
          CARGO_MAX_SPEED,
        ),
        y: this.clamp(
          (y - this.grabStart.y) / elapsed * 8 * impulseScale,
          -CARGO_MAX_SPEED,
          CARGO_MAX_SPEED,
        ),
      };
      this.matter.body.setVelocity(releasedCargo, swipeVelocity);
      this.matter.body.setAngularVelocity(releasedCargo, 0);
      this.onFeedback?.("cargo-released");
      this.grabbedCargo = undefined;
      this.grabPointerId = undefined;
      return;
    }

    if (this.airplanePointerId === pointer.id) {
      this.releaseAirplane(pointer);
      return;
    }

    if (!this.trainGrabbedBody || this.trainGrabPointerId !== pointer.id) {
      return;
    }

    const releasedTrainBody = this.trainGrabbedBody;
    const elapsed = Math.max(this.time.now - this.trainGrabStartedAt, 1);
    const impulseScale = this.getPhysicsImpulseScale();
    const swipeVelocity = {
      x: this.clamp(
        (x - this.trainGrabStart.x) / elapsed * 7 * impulseScale,
        -TRAIN_MAX_SPEED,
        TRAIN_MAX_SPEED,
      ),
      y: this.clamp(
        (y - this.trainGrabStart.y) / elapsed * 7 * impulseScale,
        -TRAIN_MAX_SPEED,
        TRAIN_MAX_SPEED,
      ),
    };
    this.matter.body.setVelocity(releasedTrainBody, swipeVelocity);
    this.matter.body.setAngularVelocity(releasedTrainBody, 0);
    this.onFeedback?.("train-released");
    this.trainGrabbedBody = undefined;
    this.trainGrabPointerId = undefined;
    return;
  }

  private releaseAirplane(pointer: Phaser.Input.Pointer): void {
    if (this.airplanePointerId !== pointer.id) {
      return;
    }

    this.airplanePointerId = undefined;
    this.onFeedback?.("airplane-released");
  }

  private advanceActivityBeat(vehicle: ActivityVehicle): number {
    this.activityBeats[vehicle] = Math.min(
      this.activityBeats[vehicle] + 1,
      ACTIVITY_BEATS_PER_JOURNEY,
    );
    return this.activityBeats[vehicle];
  }

  private resetActivityBeats(vehicle: ActivityVehicle): void {
    this.activityBeats[vehicle] = 0;
  }

  private advanceJourney(key = "", preferredVehicle?: "truck" | "train" | "airplane"): void {
    if (this.activeVehicle === "truck") {
      this.advanceTruckJourney();
      return;
    }

    if (this.activeVehicle === "train") {
      this.advanceTrainJourney();
      return;
    }

    if (this.activeVehicle === "airplane") {
      this.advanceAirplaneJourney(key);
      return;
    }

    if (preferredVehicle === "train" && this.trainPhase === "ready") {
      this.startTrainJourney();
      return;
    }

    if (
      preferredVehicle === "airplane" &&
      this.airplanePhase === "ready" &&
      (this.truckPhase === "ready" || this.truckPhase === "quiet")
    ) {
      this.startAirplaneJourney();
      return;
    }

    if (this.truckPhase === "ready") {
      this.startTruckJourney();
      return;
    }

    if (this.truckPhase === "quiet" && this.trainPhase === "ready") {
      this.startTrainJourney();
      return;
    }

    if (this.truckPhase === "quiet" && this.trainPhase === "quiet" && this.airplanePhase === "ready") {
      this.startAirplaneJourney();
      return;
    }

    if (this.airplanePhase === "quiet" || this.trainPhase === "quiet") {
      this.onFeedback?.("quiet-response");
    }
  }

  private advanceTruckJourney(): void {
    if (this.truckPhase === "ready") {
      this.startTruckJourney();
      return;
    }

    if (this.truckPhase === "cargo" && !this.cargoRecoveryActive) {
      if (this.advanceActivityBeat("truck") >= ACTIVITY_BEATS_PER_JOURNEY) {
        this.startTruckReturn();
      } else {
        this.onActionAccepted?.();
      }
      return;
    }

    if (this.truckPhase === "quiet") {
      this.onFeedback?.("quiet-response");
    }
  }

  private advanceTrainJourney(): void {
    if (this.trainPhase === "ready") {
      this.startTrainJourney();
      return;
    }

    if (this.trainPhase === "station" && !this.trainRecoveryActive) {
      if (this.advanceActivityBeat("train") >= ACTIVITY_BEATS_PER_JOURNEY) {
        this.startTrainReturn();
      } else {
        this.onActionAccepted?.();
      }
      return;
    }

    if (this.trainPhase === "quiet") {
      this.onFeedback?.("quiet-response");
    }
  }

  private isAirplaneJourneyActive(): boolean {
    return (
      this.airplanePhase === "taking-off" ||
      this.airplanePhase === "flying" ||
      this.airplanePhase === "returning" ||
      this.airplanePhase === "recovering"
    );
  }

  private startAirplaneJourney(): void {
    if (
      !this.airplaneBody ||
      this.activeVehicle !== "none" ||
      this.airplanePhase !== "ready" ||
      (this.truckPhase !== "ready" && this.truckPhase !== "quiet")
    ) {
      return;
    }

    const takeoffPoint = this.getAirplaneTakeoffPoint();
    this.activeVehicle = "airplane";
    this.airplanePhase = "taking-off";
    this.airplaneCorridorFeedbackShown = false;
    this.resetActivityBeats("airplane");
    this.airplaneFlightTarget = takeoffPoint;
    this.airplaneRecoveryTarget = undefined;
    this.matter.body.setVelocity(this.airplaneBody, { x: 0, y: 0 });
    this.matter.body.setAngle(this.airplaneBody, 0);
    this.matter.body.setAngularVelocity(this.airplaneBody, 0);
    this.resetMotionWatch(this.airplaneBody, takeoffPoint);
    this.wakeBody(this.airplaneBody);
    this.onActionAccepted?.();
    this.onStateChange("airplane-taking-off");
  }

  private advanceAirplaneJourney(key = ""): void {
    if (this.airplanePhase === "quiet") {
      this.onFeedback?.("quiet-response");
      return;
    }

    if (this.airplanePhase !== "flying") {
      return;
    }

    const corridor = this.getAirplaneFlightBounds();
    const verticalDirection =
      key === "ArrowUp" || key.toLowerCase() === "w"
        ? -1
        : key === "ArrowDown" || key.toLowerCase() === "s"
          ? 1
          : this.activityBeats.airplane === 0
            ? -1
            : 1;
    const horizontalDirection =
      key === "ArrowLeft" || key.toLowerCase() === "a"
        ? -1
        : key === "ArrowRight" || key.toLowerCase() === "d"
          ? 1
          : 0;
    const nextInputCount = this.advanceActivityBeat("airplane");

    this.airplaneFlightTarget = {
      x: this.clamp(
        (this.airplaneBody?.position.x ?? (corridor.minX + corridor.maxX) / 2) + horizontalDirection * 74,
        corridor.minX + 24,
        corridor.maxX - 24,
      ),
      y: this.clamp(
        (this.airplaneBody?.position.y ?? (corridor.minY + corridor.maxY) / 2) + verticalDirection * 58,
        corridor.minY + 24,
        corridor.maxY - 24,
      ),
    };
    if (this.airplaneBody) {
      this.resetMotionWatch(this.airplaneBody, this.airplaneFlightTarget);
    }

    if (nextInputCount >= ACTIVITY_BEATS_PER_JOURNEY) {
      this.startAirplaneReturn();
      return;
    }

    this.onActionAccepted?.();
  }

  private startAirplaneReturn(): void {
    if (!this.airplaneBody || this.activeVehicle !== "airplane" || this.airplanePhase !== "flying") {
      return;
    }

    this.airplanePhase = "returning";
    this.airplaneFlightTarget = this.getAirplaneHangarPoint();
    this.wakeBody(this.airplaneBody);
    this.matter.body.setVelocity(this.airplaneBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.airplaneBody, 0);
    this.resetMotionWatch(this.airplaneBody, this.getAirplaneHangarPoint());
    this.onActionAccepted?.();
    this.onStateChange("airplane-returning");
  }

  private settleAirplaneAtHangar(): void {
    if (!this.airplaneBody) {
      return;
    }

    this.matter.body.setPosition(this.airplaneBody, this.getAirplaneHangarPoint());
    this.matter.body.setVelocity(this.airplaneBody, { x: 0, y: 0 });
    this.matter.body.setAngle(this.airplaneBody, 0);
    this.matter.body.setAngularVelocity(this.airplaneBody, 0);
    this.airplanePointerId = undefined;
    this.airplaneRecoveryTarget = undefined;
    this.airplanePhase = "quiet";
    this.resetActivityBeats("airplane");
    this.activeVehicle = "none";
    this.completeJourney();
    this.onStateChange("airplane-quiet");
  }

  private updateAirplaneJourneyMovement(deltaMs: number): void {
    if (!this.airplaneBody) {
      return;
    }

    if (this.airplaneRecoveryTarget) {
      const reachedRecoveryTarget = this.moveAirplaneTowards(
        this.airplaneRecoveryTarget,
        AIRPLANE_SPEED,
        deltaMs,
      );
      if (!reachedRecoveryTarget) {
        return;
      }

      this.airplaneRecoveryTarget = undefined;
      this.airplanePhase = this.airplaneRecoveryResumePhase;
      this.matter.body.setAngle(this.airplaneBody, 0);
      this.onFeedback?.("airplane-recovered");
      this.onStateChange(this.getAirplaneState());
      return;
    }

    if (this.airplanePhase === "taking-off") {
      if (this.moveAirplaneTowards(this.getAirplaneTakeoffPoint(), AIRPLANE_SPEED, deltaMs)) {
        this.airplanePhase = "flying";
        this.airplaneFlightTarget = this.getAirplaneFlightCenter();
        this.onStateChange("airplane-flying");
      }
      return;
    }

    if (this.airplanePhase === "flying") {
      this.moveAirplaneTowards(this.airplaneFlightTarget, AIRPLANE_FLIGHT_SPEED, deltaMs);
      return;
    }

    if (
      this.airplanePhase === "returning" &&
      this.moveAirplaneTowards(this.getAirplaneHangarPoint(), AIRPLANE_SPEED, deltaMs)
    ) {
      this.settleAirplaneAtHangar();
    }
  }

  private moveAirplaneTowards(
    destination: { x: number; y: number },
    speed: number,
    deltaMs: number,
  ): boolean {
    if (!this.airplaneBody) {
      return false;
    }

    const profile = {
      ...AIRPLANE_GUIDED_PROFILE,
      maxSpeed: speed,
    };
    const step = stepGuidedMotion(
      {
        position: this.airplaneBody.position,
        velocity: this.airplaneBody.velocity,
      },
      destination,
      profile,
      deltaMs,
    );
    this.wakeBody(this.airplaneBody);
    this.matter.body.setVelocity(this.airplaneBody, step.velocity);
    this.dampenAngularVelocity(this.airplaneBody, 0.04);
    return step.arrived;
  }

  private updateAirplaneCorridorFeedback(): void {
    if (
      this.airplaneCorridorFeedbackShown ||
      !this.airplaneBody ||
      this.airplanePhase !== "flying" ||
      this.airplanePointerId === undefined
    ) {
      return;
    }

    const corridor = this.getAirplaneFlightBounds();
    const boundedTarget = this.airplaneFlightTarget;
    const boundaryTargets = [
      { x: corridor.minX + 24, y: boundedTarget.y },
      { x: corridor.maxX - 24, y: boundedTarget.y },
      { x: boundedTarget.x, y: corridor.minY + 24 },
      { x: boundedTarget.x, y: corridor.maxY - 24 },
    ];
    const targetIsOnCorridorBoundary = boundaryTargets.some(
      (boundaryTarget) =>
        Phaser.Math.Distance.Between(
          boundedTarget.x,
          boundedTarget.y,
          boundaryTarget.x,
          boundaryTarget.y,
        ) <= 0.5,
    );
    if (!targetIsOnCorridorBoundary) {
      return;
    }

    const bodyHasReachedBound = Phaser.Math.Distance.Between(
      this.airplaneBody.position.x,
      this.airplaneBody.position.y,
      boundedTarget.x,
      boundedTarget.y,
    ) <= 14;
    if (bodyHasReachedBound) {
      this.airplaneCorridorFeedbackShown = true;
      this.onFeedback?.("airplane-corridor");
    }
  }

  private updateAirplaneSafety(_deltaMs: number): void {
    if (!this.airplaneBody) {
      return;
    }

    this.limitBodyVelocity(this.airplaneBody, AIRPLANE_MAX_SPEED);
    this.dampenAngularVelocity(this.airplaneBody, 0.04);

    if (!this.isAirplaneJourneyActive()) {
      return;
    }

    const corridor = this.getAirplaneFlightBounds();
    const isFlying = this.airplanePhase === "flying";
    const minX = isFlying ? corridor.minX - 30 : 36;
    const maxX = isFlying ? corridor.maxX + 30 : this.getWorldWidth() - 36;
    const minY = isFlying ? corridor.minY - 30 : 36;
    const maxY = isFlying ? corridor.maxY + 30 : this.getWorldHeight() - 90;
    const position = this.airplaneBody.position;
    const isOutOfBounds =
      position.x < minX || position.x > maxX || position.y < minY || position.y > maxY;
    const isInverted = Math.abs(this.airplaneBody.angle) > AIRPLANE_MAX_TILT * 2;

    if ((isOutOfBounds || isInverted) && this.airplanePhase !== "recovering") {
      this.beginAirplaneRecovery();
      return;
    }

  }

  private updateAirplaneGrabbed(): void {
    if (!this.airplaneBody || this.airplanePointerId === undefined || this.airplanePhase !== "flying") {
      return;
    }

    const target = this.airplaneGrabTarget;
    const pointerPosition = {
      x: target.x + this.airplaneGrabOffset.x,
      y: target.y + this.airplaneGrabOffset.y,
    };
    const pointerTargetIsUnsafe =
      pointerPosition.x < 42 ||
      pointerPosition.x > this.getWorldWidth() - 42 ||
      pointerPosition.y < 42 ||
      pointerPosition.y > this.getWorldHeight() - 42;
    if (pointerTargetIsUnsafe) {
      this.beginAirplaneRecovery();
      return;
    }

    const corridor = this.getAirplaneFlightBounds();
    const boundedTarget = {
      x: this.clamp(target.x, corridor.minX + 24, corridor.maxX - 24),
      y: this.clamp(target.y, corridor.minY + 24, corridor.maxY - 24),
    };
    const targetWasConstrained = boundedTarget.x !== target.x || boundedTarget.y !== target.y;
    this.airplaneFlightTarget = boundedTarget;
    if (targetWasConstrained && !this.airplaneCorridorFeedbackShown) {
      this.airplaneCorridorFeedbackShown = true;
      this.onFeedback?.("airplane-corridor");
    }
    this.matter.body.setAngularVelocity(this.airplaneBody, 0);
  }

  private updateAirplaneVisual(deltaMs: number): void {
    if (!this.airplaneBody || !this.airplaneVisual) {
      return;
    }

    const activeScale = this.activeVehicle === "airplane" ? this.getActiveVehicleVisualScale() : 0.78;
    this.airplaneVisual
      .setPosition(this.airplaneBody.position.x, this.airplaneBody.position.y)
      .setRotation(this.airplaneBody.angle * (this.reducedMotion ? 0.35 : 1))
      .setScale(activeScale);
    this.airplaneVisual.setAlpha(this.activeVehicle === "airplane" ? 1 : 0.66);
    if (this.airplanePropeller && !this.reducedMotion) {
      const speed = Math.max(0.25, Math.hypot(this.airplaneBody.velocity.x, this.airplaneBody.velocity.y));
      this.airplanePropeller.rotation += speed * 0.12 * (deltaMs / 16.67);
    }
  }

  private beginAirplaneGrab(pointer: Phaser.Input.Pointer): void {
    if (!this.airplaneBody || this.airplanePhase !== "flying") {
      return;
    }

    const { x, y } = this.getPointerWorldPosition(pointer);
    this.airplanePointerId = pointer.id;
    this.airplaneGrabOffset.x = this.clamp(
      x - this.airplaneBody.position.x,
      -AIRPLANE_WIDTH / 2,
      AIRPLANE_WIDTH / 2,
    );
    this.airplaneGrabOffset.y = this.clamp(
      y - this.airplaneBody.position.y,
      -AIRPLANE_HEIGHT / 2,
      AIRPLANE_HEIGHT / 2,
    );
    this.airplaneGrabTarget.x = this.airplaneBody.position.x;
    this.airplaneGrabTarget.y = this.airplaneBody.position.y;
    this.matter.body.setAngularVelocity(this.airplaneBody, 0);
    this.onFeedback?.("airplane-grabbed");
  }

  private findAirplaneAt(x: number, y: number): boolean {
    if (!this.airplaneBody) {
      return false;
    }

    const cosine = Math.cos(this.airplaneBody.angle);
    const sine = Math.sin(this.airplaneBody.angle);
    const toLocal = (point: { x: number; y: number }) => {
      const offsetX = point.x - this.airplaneBody!.position.x;
      const offsetY = point.y - this.airplaneBody!.position.y;
      return {
        x: (offsetX * cosine + offsetY * sine) / AIRPLANE_GRAB_BOUNDS.halfWidth,
        y: (-offsetX * sine + offsetY * cosine) / AIRPLANE_GRAB_BOUNDS.halfHeight,
      };
    };
    const pointer = toLocal({ x, y });
    const target = toLocal(this.airplaneFlightTarget);
    const targetLengthSquared = target.x * target.x + target.y * target.y;
    const projection =
      targetLengthSquared === 0
        ? 0
        : this.clamp((pointer.x * target.x + pointer.y * target.y) / targetLengthSquared, 0, 1);
    const nearestPoint = {
      x: target.x * projection,
      y: target.y * projection,
    };
    const distanceX = pointer.x - nearestPoint.x;
    const distanceY = pointer.y - nearestPoint.y;
    return distanceX * distanceX + distanceY * distanceY <= 1;
  }

  private isNearAirplaneRestingPlace(x: number, y: number): boolean {
    const restingPoint = this.getAirplaneHangarPoint();
    const xDistance = Math.abs(restingPoint.x - x);
    const yDistance = Math.abs(restingPoint.y - y);
    return xDistance <= AIRPLANE_GRAB_RADIUS + 30 && yDistance <= AIRPLANE_HEIGHT + 20;
  }

  private isAtTrainRestingPlace(x: number, y: number): boolean {
    const restingPoint = this.getTrainStartingPoint();
    return (
      Math.abs(restingPoint.x - x) <= TRAIN_WIDTH * 0.65 &&
      Math.abs(restingPoint.y - y) <= TRAIN_HEIGHT + 32
    );
  }

  private isAtAirplaneRestingPlace(x: number, y: number): boolean {
    const restingPoint = this.getAirplaneHangarPoint();
    return (
      Math.abs(restingPoint.x - x) <= AIRPLANE_WIDTH * 0.6 &&
      Math.abs(restingPoint.y - y) <= AIRPLANE_HEIGHT + 20
    );
  }

  private beginAirplaneRecovery(): void {
    if (!this.airplaneBody || this.airplanePhase === "recovering") {
      return;
    }

    const resumePhase =
      this.airplanePhase === "returning"
        ? "returning"
        : this.airplanePhase === "taking-off"
          ? "taking-off"
          : "flying";
    this.airplaneRecoveryResumePhase = resumePhase;
    this.airplaneRecoveryTarget =
      resumePhase === "returning"
        ? this.getAirplaneHangarPoint()
        : resumePhase === "taking-off"
          ? this.getAirplaneTakeoffPoint()
          : this.getAirplaneFlightCenter();
    this.airplanePointerId = undefined;
    this.airplanePhase = "recovering";
    this.matter.body.setVelocity(this.airplaneBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.airplaneBody, 0);
    this.onStateChange("airplane-recovering");
  }

  private getAirplaneState(): DepotTenangState {
    if (this.airplanePhase === "taking-off") {
      return "airplane-taking-off";
    }
    if (this.airplanePhase === "flying") {
      return "airplane-flying";
    }
    if (this.airplanePhase === "returning") {
      return "airplane-returning";
    }
    if (this.airplanePhase === "recovering") {
      return "airplane-recovering";
    }
    return "airplane-quiet";
  }

  private getAirplaneHangarPoint(): { x: number; y: number } {
    return {
      x: this.getWorldWidth() * 0.83,
      y: Math.min(this.getWorldHeight() * AIRPLANE_HANGAR_Y_RATIO, this.getWorldHeight() - 96),
    };
  }

  private getAirplaneTakeoffPoint(): { x: number; y: number } {
    const corridor = this.getAirplaneFlightBounds();
    return { x: corridor.maxX, y: corridor.maxY };
  }

  private getAirplaneFlightCenter(): { x: number; y: number } {
    const corridor = this.getAirplaneFlightBounds();
    return {
      x: (corridor.minX + corridor.maxX) / 2,
      y: (corridor.minY + corridor.maxY) / 2,
    };
  }

  private getAirplaneFlightBounds(
    width = this.getWorldWidth(),
    height = this.getWorldHeight(),
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const minX = width * AIRPLANE_FLIGHT_MIN_X_RATIO;
    const maxX = width * AIRPLANE_FLIGHT_MAX_X_RATIO;
    const minY = height * AIRPLANE_FLIGHT_MIN_Y_RATIO;
    const maxY = Math.min(height * AIRPLANE_FLIGHT_MAX_Y_RATIO, ROAD_Y - AIRPLANE_HEIGHT);
    return { minX, maxX, minY, maxY };
  }

  private startTruckJourney(): void {
    if (!this.truckBody || this.activeVehicle !== "none") {
      return;
    }

    this.activeVehicle = "truck";
    this.truckPhase = "moving";
    this.truckAnticipationRemaining = this.reducedMotion ? 90 : 220;
    this.truckSettleOffset = 0;
    this.truckSettleVelocity = 0;
    this.truckDustCooldown = 0;
    this.resetActivityBeats("truck");
    this.wakeBody(this.truckBody);
    this.matter.body.setVelocity(this.truckBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
    this.resetMotionWatch(this.truckBody, this.getTruckArrivalPoint());
    this.onActionAccepted?.();
    this.onStateChange("moving");
  }

  private startTruckReturn(): void {
    if (!this.truckBody || this.activeVehicle !== "truck") {
      return;
    }

    this.truckPhase = "returning";
    this.truckAnticipationRemaining = this.reducedMotion ? 60 : 140;
    this.wakeBody(this.truckBody);
    this.matter.body.setVelocity(this.truckBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
    for (const cargo of this.cargoBodies) {
      cargo.ignoreGravity = true;
      cargo.isSensor = true;
      this.wakeBody(cargo);
    }
    this.resetMotionWatch(this.truckBody, this.getTruckStartingPoint());
    this.onActionAccepted?.();
    this.onStateChange("returning");
  }

  private settleTruckAtArrival(): void {
    if (!this.truckBody) {
      return;
    }

    const arrivalPoint = this.getTruckArrivalPoint();
    this.matter.body.setPosition(this.truckBody, arrivalPoint);
    this.matter.body.setVelocity(this.truckBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
    this.truckSettleOffset = this.reducedMotion ? 1.5 : 5;
    this.truckSettleVelocity = 0;
    this.createCargo();
    this.truckPhase = "cargo";
    this.onStateChange("cargo");
  }

  private settleTruckAtGarage(): void {
    if (!this.truckBody) {
      return;
    }

    this.matter.body.setPosition(this.truckBody, this.getTruckStartingPoint());
    this.matter.body.setVelocity(this.truckBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
    this.truckSettleOffset = this.reducedMotion ? 1 : 4;
    this.truckSettleVelocity = 0;
    this.clearCargo();
    this.truckPhase = "quiet";
    this.activeVehicle = "none";
    this.completeJourney();
    this.onStateChange("quiet");
  }

  private startTrainJourney(): void {
    if (!this.trainBody || this.activeVehicle !== "none" || this.trainPhase !== "ready") {
      return;
    }

    this.activeVehicle = "train";
    this.trainPhase = "moving";
    this.trainSwayFeedbackShown = false;
    this.resetActivityBeats("train");
    this.wakeTrainBodies();
    this.matter.body.setVelocity(this.trainBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.trainBody, 0);
    this.resetTrainMotionWatches(this.getTrainArrivalPoint());
    this.onActionAccepted?.();
    this.onStateChange("train-moving");
  }

  private startTrainReturn(): void {
    if (!this.trainBody || this.activeVehicle !== "train" || this.trainPhase !== "station") {
      return;
    }

    this.trainPhase = "returning";
    this.wakeTrainBodies();
    this.matter.body.setVelocity(this.trainBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.trainBody, 0);
    this.resetTrainMotionWatches(this.getTrainStartingPoint());
    this.onActionAccepted?.();
    this.onStateChange("train-returning");
  }

  private settleTrainAtStation(): void {
    if (!this.trainBody || this.trainPhase !== "moving") {
      return;
    }

    this.setTrainFormation(this.getTrainArrivalPoint());
    this.trainPhase = "station";
    this.onStateChange("train-station");
  }

  private settleTrainAtDepot(): void {
    if (!this.trainBody || this.trainPhase !== "returning") {
      return;
    }

    this.setTrainFormation(this.getTrainStartingPoint());
    this.trainPhase = "quiet";
    this.activeVehicle = "none";
    this.completeJourney();
    this.onStateChange("train-quiet");
  }

  private completeJourney(): void {
    if (this.completedJourneys >= 3) {
      return;
    }

    this.completedJourneys += 1;
    this.layoutDiorama();
    this.onJourneyComplete?.(this.completedJourneys);

    if (this.completedJourneys === 3 && !this.playCycleQuietEntered) {
      this.playCycleQuietEntered = true;
      this.onPlayCycleComplete?.();
    }
  }

  private setTrainFormation(anchor: { x: number; y: number }): void {
    if (!this.trainBody) {
      return;
    }

    this.matter.body.setPosition(this.trainBody, anchor);
    this.matter.body.setVelocity(this.trainBody, { x: 0, y: 0 });
    this.matter.body.setAngle(this.trainBody, 0);
    this.matter.body.setAngularVelocity(this.trainBody, 0);

    for (const [index, carriage] of this.trainCarriageBodies.entries()) {
      const position = this.getTrainCarriagePosition(anchor, index);
      this.matter.body.setPosition(carriage, position);
      this.matter.body.setVelocity(carriage, { x: 0, y: 0 });
      this.matter.body.setAngle(carriage, 0);
      this.matter.body.setAngularVelocity(carriage, 0);
    }
  }

  private beginCargoGrab(cargo: MatterJS.BodyType, pointer: Phaser.Input.Pointer): void {
    const { x, y } = this.getPointerWorldPosition(pointer);
    this.grabbedCargo = cargo;
    this.grabPointerId = pointer.id;
    this.grabOffset.x = x - cargo.position.x;
    this.grabOffset.y = y - cargo.position.y;
    this.grabTarget.x = cargo.position.x;
    this.grabTarget.y = cargo.position.y;
    this.grabStart.x = x;
    this.grabStart.y = y;
    this.grabStartedAt = this.time.now;
    this.matter.body.setAngularVelocity(cargo, 0);
    this.resetMotionWatch(cargo, this.grabTarget);
    this.onFeedback?.("cargo-grabbed");
  }

  private beginTrainGrab(trainBody: MatterJS.BodyType, pointer: Phaser.Input.Pointer): void {
    const { x, y } = this.getPointerWorldPosition(pointer);
    this.trainGrabbedBody = trainBody;
    this.trainGrabPointerId = pointer.id;
    this.trainGrabOffset.x = x - trainBody.position.x;
    this.trainGrabOffset.y = y - trainBody.position.y;
    this.trainGrabTarget.x = trainBody.position.x;
    this.trainGrabTarget.y = trainBody.position.y;
    this.trainGrabStart.x = x;
    this.trainGrabStart.y = y;
    this.trainGrabStartedAt = this.time.now;
    this.matter.body.setAngularVelocity(trainBody, 0);
    this.resetMotionWatch(trainBody, this.trainGrabTarget);
    this.onFeedback?.("train-grabbed");
  }

  private claimTouch(pointer: Phaser.Input.Pointer): boolean {
    if (!this.isTouchPointer(pointer)) {
      return true;
    }

    if (this.activeTouchId !== undefined) {
      return false;
    }

    this.activeTouchId = pointer.id;
    return true;
  }

  private isTouchPointer(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event as (TouchEvent & { pointerType?: string }) | undefined;
    return (
      event?.type.startsWith("touch") === true ||
      event?.pointerType === "touch" ||
      (event !== undefined && "touches" in event) ||
      this.sys.game.device.input.touch
    );
  }

  private getPointerWorldPosition(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return {
      x: pointer.worldX,
      y: pointer.worldY,
    };
  }

  private isPointerNearStageEdge(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x < 42 ||
      pointer.x > this.scale.width - 42 ||
      pointer.y < 42 ||
      pointer.y > this.scale.height - 42
    );
  }

  private isAtAirplaneFollowFocus(pointer: Phaser.Input.Pointer): boolean {
    return (
      Math.abs(pointer.x - this.scale.width * 0.36) <= 150 &&
      Math.abs(pointer.y - this.scale.height * 0.32) <= 100
    );
  }

  private isAtTruckRestingPlace(x: number, y: number): boolean {
    const roadY = Math.min(ROAD_Y, this.getWorldHeight() * 0.75);
    const restingPlace = {
      x: this.getWorldWidth() * TRUCK_START_RATIO,
      y: roadY - 58,
    };
    const forgivingRadius = Math.max(
      86,
      Math.min(this.getWorldWidth(), this.getWorldHeight()) * 0.16,
    );

    return Math.hypot(x - restingPlace.x, y - restingPlace.y) <= forgivingRadius;
  }

  private findCargoAt(x: number, y: number): MatterJS.BodyType | undefined {
    return this.cargoBodies.find((cargo) => {
      const distance = Math.hypot(cargo.position.x - x, cargo.position.y - y);
      return distance <= CARGO_GRAB_RADIUS;
    });
  }

  private findTrainBodyAt(x: number, y: number): MatterJS.BodyType | undefined {
    return [this.trainBody, ...this.trainCarriageBodies].find((trainBody) => {
      if (!trainBody) {
        return false;
      }

      const distance = Math.hypot(trainBody.position.x - x, trainBody.position.y - y);
      return distance <= TRAIN_GRAB_RADIUS + 32;
    });
  }

  private updateGrabbedBodyPhysics(
    body: MatterJS.BodyType,
    target: { x: number; y: number },
    maxSpeed: number,
    maxAngularSpeed: number,
    deltaMs: number,
  ): boolean {
    const pointerTargetIsUnsafe =
      target.x < 30 ||
      target.x > this.getWorldWidth() - 30 ||
      target.y < 30 ||
      target.y > this.getWorldHeight() - 30;
    if (pointerTargetIsUnsafe) {
      return false;
    }

    const impulseScale = this.getPhysicsImpulseScale();
    const profile: GuidedMotionProfile = {
      ...SOFT_GRAB_GUIDED_PROFILE,
      acceleration: SOFT_GRAB_GUIDED_PROFILE.acceleration * impulseScale,
      deceleration: SOFT_GRAB_GUIDED_PROFILE.deceleration * impulseScale,
      maxSpeed: maxSpeed * impulseScale,
    };
    const step = stepGuidedMotion(
      {
        position: body.position,
        velocity: body.velocity,
      },
      target,
      profile,
      deltaMs,
    );
    this.wakeBody(body);
    this.matter.body.setVelocity(body, step.velocity);
    this.dampenAngularVelocity(body, maxAngularSpeed);
    return true;
  }

  private updateGrabbedCargo(deltaMs: number): void {
    if (!this.grabbedCargo || this.cargoRecoveryTargets.has(this.grabbedCargo)) {
      return;
    }

    const grabbedCargo = this.grabbedCargo;
    if (
      !this.updateGrabbedBodyPhysics(
        grabbedCargo,
        this.grabTarget,
        CARGO_MAX_SPEED,
        CARGO_MAX_ANGULAR_SPEED,
        deltaMs,
      )
    ) {
      this.beginCargoRecovery(grabbedCargo);
    }
  }

  private updateGrabbedTrain(deltaMs: number): void {
    if (!this.trainGrabbedBody || this.trainRecoveryTargets.has(this.trainGrabbedBody)) {
      return;
    }

    if (
      !this.updateGrabbedBodyPhysics(
        this.trainGrabbedBody,
        this.trainGrabTarget,
        TRAIN_MAX_SPEED,
        TRAIN_MAX_ANGULAR_SPEED,
        deltaMs,
      )
    ) {
      this.beginTrainRecovery();
    }
  }

  private updateTruckStuckDetection(): void {
    if (
      !this.truckBody ||
      this.activeVehicle !== "truck" ||
      (this.truckPhase !== "moving" && this.truckPhase !== "returning") ||
      this.truckRecoveryTarget
    ) {
      return;
    }

    const target =
      this.truckPhase === "returning" ? this.getTruckStartingPoint() : this.getTruckArrivalPoint();
    if (this.isBodyStuck(this.truckBody, target)) {
      this.beginTruckRecovery();
    }
  }

  private beginTruckRecovery(): void {
    if (!this.truckBody || this.truckRecoveryTarget) {
      return;
    }

    this.truckRecoveryTarget =
      this.truckPhase === "returning" || this.truckPhase === "quiet"
        ? this.getTruckStartingPoint()
        : this.getTruckArrivalPoint();
    this.resetMotionWatch(this.truckBody, this.truckRecoveryTarget);
    this.onStateChange("recovering");
  }

  private updateCargoStuckDetection(): void {
    if (
      this.truckPhase !== "cargo" ||
      !this.grabbedCargo ||
      this.grabPointerId === undefined ||
      this.cargoRecoveryTargets.has(this.grabbedCargo)
    ) {
      return;
    }

    if (this.isBodyStuck(this.grabbedCargo, this.grabTarget)) {
      this.beginCargoRecovery(this.grabbedCargo);
    }
  }

  private updateTrainStuckDetection(): void {
    if (!this.trainBody || this.trainRecoveryActive) {
      return;
    }

    if (this.trainPhase === "moving" || this.trainPhase === "returning") {
      const anchor =
        this.trainPhase === "returning" ? this.getTrainStartingPoint() : this.getTrainArrivalPoint();
      const trainBodies = this.getTrainBodies();
      for (const [index, trainBody] of trainBodies.entries()) {
        const target = index === 0 ? anchor : this.getTrainCarriagePosition(anchor, index - 1);
        if (this.isBodyStuck(trainBody, target)) {
          this.beginTrainRecovery();
          return;
        }
      }
    }

    if (
      this.trainGrabbedBody &&
      this.trainGrabPointerId !== undefined &&
      this.trainPhase !== "quiet" &&
      this.isBodyStuck(this.trainGrabbedBody, this.trainGrabTarget)
    ) {
      this.beginTrainRecovery();
    }
  }

  private updateAirplaneStuckDetection(): void {
    if (
      !this.airplaneBody ||
      !this.isAirplaneJourneyActive() ||
      this.airplanePhase === "recovering" ||
      this.airplaneRecoveryTarget
    ) {
      return;
    }

    const target =
      this.airplanePhase === "taking-off"
        ? this.getAirplaneTakeoffPoint()
        : this.airplanePhase === "returning"
          ? this.getAirplaneHangarPoint()
          : this.airplaneFlightTarget;
    if (this.isBodyStuck(this.airplaneBody, target)) {
      this.beginAirplaneRecovery();
    }
  }

  private resetTrainMotionWatches(anchor: { x: number; y: number }): void {
    if (!this.trainBody) {
      return;
    }

    this.resetMotionWatch(this.trainBody, anchor);
    for (const [index, carriage] of this.trainCarriageBodies.entries()) {
      this.resetMotionWatch(carriage, this.getTrainCarriagePosition(anchor, index));
    }
  }

  private resetMotionWatch(
    body: MatterJS.BodyType,
    target: { x: number; y: number } = body.position,
  ): void {
    this.motionWatches.set(body, {
      position: { x: body.position.x, y: body.position.y },
      target: { x: target.x, y: target.y },
      lowMotionSince: this.time.now,
    });
  }

  private isBodyStuck(body: MatterJS.BodyType, target: { x: number; y: number }): boolean {
    const now = this.time.now;
    const previous = this.motionWatches.get(body);
    const position = { x: body.position.x, y: body.position.y };
    const targetPosition = { x: target.x, y: target.y };
    const targetChanged =
      previous !== undefined &&
      Phaser.Math.Distance.Between(
        previous.target.x,
        previous.target.y,
        targetPosition.x,
        targetPosition.y,
      ) > RECOVERY_TARGET_CHANGE_DISTANCE;
    const movedDistance =
      previous === undefined
        ? Number.POSITIVE_INFINITY
        : Phaser.Math.Distance.Between(
            previous.position.x,
            previous.position.y,
            position.x,
            position.y,
          );
    const lowMotionSince =
      previous === undefined ||
      targetChanged ||
      movedDistance > RECOVERY_LOW_MOTION_DISTANCE
        ? now
        : previous.lowMotionSince;

    this.motionWatches.set(body, {
      position,
      target: targetPosition,
      lowMotionSince,
    });

    const lowMotionElapsed = this.clamp(now - lowMotionSince, 0, RECOVERY_STUCK_TIMEOUT_MS);
    const targetDistance = Phaser.Math.Distance.Between(
      position.x,
      position.y,
      targetPosition.x,
      targetPosition.y,
    );
    return targetDistance > RECOVERY_TARGET_DISTANCE && lowMotionElapsed >= RECOVERY_STUCK_TIMEOUT_MS;
  }

  private updateTruckSafety(deltaMs: number): void {
    if (!this.truckBody) {
      return;
    }

    this.limitBodyVelocity(this.truckBody, TRUCK_MAX_SPEED);
    this.dampenAngularVelocity(this.truckBody, 0.04);

    const position = this.truckBody.position;
    const isOutOfBounds =
      position.x < -80 ||
      position.x > this.getWorldWidth() + 80 ||
      position.y < -80 ||
      position.y > this.getWorldHeight() + 80;

    if (isOutOfBounds && !this.truckRecoveryTarget) {
      this.beginTruckRecovery();
    }

    if (!this.truckRecoveryTarget) {
      return;
    }

    const step = stepGuidedMotion(
      {
        position: this.truckBody.position,
        velocity: this.truckBody.velocity,
      },
      this.truckRecoveryTarget,
      TRUCK_RECOVERY_GUIDED_PROFILE,
      deltaMs,
    );
    this.wakeBody(this.truckBody);
    this.matter.body.setVelocity(this.truckBody, step.velocity);
    this.dampenAngularVelocity(this.truckBody, 0.04);

    if (step.arrived) {
      this.matter.body.setPosition(this.truckBody, this.truckRecoveryTarget);
      this.matter.body.setVelocity(this.truckBody, { x: 0, y: 0 });
      this.matter.body.setAngularVelocity(this.truckBody, 0);
      this.truckRecoveryTarget = undefined;
      this.onStateChange(this.truckPhase);
    }
  }

  private updateTrainConstraintFeedback(): void {
    if (
      this.trainSwayFeedbackShown ||
      !this.trainGrabbedBody ||
      this.trainRecoveryActive ||
      this.trainConstraints.length === 0
    ) {
      return;
    }

    const carriageIndex = this.trainCarriageBodies.indexOf(this.trainGrabbedBody);
    const connectedBody =
      carriageIndex === 0
        ? this.trainBody
        : carriageIndex > 0
          ? this.trainCarriageBodies[carriageIndex - 1]
          : undefined;
    if (!connectedBody) {
      return;
    }

    const carriage = this.trainGrabbedBody;
    const distance = Phaser.Math.Distance.Between(
      connectedBody.position.x,
      connectedBody.position.y,
      carriage.position.x,
      carriage.position.y,
    );
    const targetDistance = Phaser.Math.Distance.Between(
      connectedBody.position.x,
      connectedBody.position.y,
      this.trainGrabTarget.x,
      this.trainGrabTarget.y,
    );
    const distanceShowsConstraintLoad =
      (distance > TRAIN_CARRIAGE_GAP + 8 && distance < TRAIN_CARRIAGE_GAP * 4) ||
      (targetDistance > TRAIN_CARRIAGE_GAP + 8 && targetDistance < TRAIN_CARRIAGE_GAP * 4);
    const carriageShowsSway =
      Math.abs(carriage.position.y - connectedBody.position.y) > 8 ||
      Math.abs(this.trainGrabTarget.y - connectedBody.position.y) > 8 ||
      Math.abs(carriage.angle) > 0.08;

    if (distanceShowsConstraintLoad || carriageShowsSway) {
      this.trainSwayFeedbackShown = true;
      this.onFeedback?.("train-sway");
    }
  }

  private updateTrainSafety(deltaMs: number): void {
    const trainBodies = this.getTrainBodies();
    if (trainBodies.length === 0) {
      return;
    }

    for (const trainBody of trainBodies) {
      this.limitBodyVelocity(trainBody, TRAIN_MAX_SPEED);
      this.dampenAngularVelocity(trainBody, TRAIN_MAX_ANGULAR_SPEED);

      if (this.trainRecoveryTargets.has(trainBody)) {
        this.moveTrainToRecoveryTarget(trainBody, deltaMs);
      }
    }

    if (!this.trainRecoveryActive && this.isTrainUnsafe()) {
      this.beginTrainRecovery();
    }

    if (this.trainRecoveryActive && this.trainRecoveryTargets.size === 0) {
      this.trainRecoveryActive = false;
      this.onFeedback?.("train-recovered");
      this.onStateChange(this.getTrainState());
    }
  }

  private isTrainUnsafe(): boolean {
    const railY = this.getTrainRailY();
    for (const trainBody of this.getTrainBodies()) {
      const position = trainBody.position;
      const isOutOfBounds =
        position.x < -70 ||
        position.x > this.getWorldWidth() + 70 ||
        position.y < railY - TRAIN_TRACK_MARGIN ||
        position.y > railY + TRAIN_TRACK_MARGIN;
      const isInverted = Math.abs(trainBody.angle) > Math.PI * 0.75;
      if (isOutOfBounds || isInverted) {
        return true;
      }
    }

    if (!this.trainBody) {
      return false;
    }

    return this.trainCarriageBodies.some((carriage) => {
      const distance = Phaser.Math.Distance.Between(
        this.trainBody?.position.x ?? 0,
        this.trainBody?.position.y ?? 0,
        carriage.position.x,
        carriage.position.y,
      );
      return distance > TRAIN_CARRIAGE_GAP * 4;
    });
  }

  private beginTrainRecovery(): void {
    if (this.trainRecoveryActive || !this.trainBody) {
      return;
    }

    this.trainGrabbedBody = undefined;
    this.trainGrabPointerId = undefined;
    const anchor = this.getTrainRecoveryAnchor();
    this.trainRecoveryTargets.clear();
    this.trainRecoveryTargets.set(this.trainBody, anchor);
    for (const [index, carriage] of this.trainCarriageBodies.entries()) {
      this.trainRecoveryTargets.set(carriage, this.getTrainCarriagePosition(anchor, index));
    }
    for (const trainBody of this.getTrainBodies()) {
      this.matter.body.setVelocity(trainBody, { x: 0, y: 0 });
      this.matter.body.setAngularVelocity(trainBody, 0);
      const target = this.trainRecoveryTargets.get(trainBody);
      if (target) {
        this.resetMotionWatch(trainBody, target);
      }
    }
    this.trainRecoveryActive = true;
    this.onStateChange("train-recovering");
  }

  private moveTrainToRecoveryTarget(trainBody: MatterJS.BodyType, deltaMs: number): void {
    const target = this.trainRecoveryTargets.get(trainBody);
    if (!target) {
      return;
    }

    const step = stepGuidedMotion(
      {
        position: trainBody.position,
        velocity: trainBody.velocity,
      },
      target,
      TRAIN_RECOVERY_GUIDED_PROFILE,
      deltaMs,
    );
    this.wakeBody(trainBody);
    this.matter.body.setVelocity(trainBody, step.velocity);
    this.dampenAngularVelocity(trainBody, TRAIN_MAX_ANGULAR_SPEED);

    if (step.arrived) {
      this.matter.body.setPosition(trainBody, target);
      this.matter.body.setVelocity(trainBody, { x: 0, y: 0 });
      this.matter.body.setAngle(trainBody, 0);
      this.matter.body.setAngularVelocity(trainBody, 0);
      this.trainRecoveryTargets.delete(trainBody);
      return;
    }
  }

  private getTrainRecoveryAnchor(): { x: number; y: number } {
    if (this.trainPhase === "returning" || this.trainPhase === "quiet") {
      return this.getTrainStartingPoint();
    }

    if (this.trainPhase === "station") {
      return this.getTrainArrivalPoint();
    }

    const currentX = this.trainBody?.position.x ?? this.getTrainArrivalPoint().x;
    return {
      x: this.clamp(currentX, this.getTrainArrivalPoint().x, this.getTrainStartingPoint().x),
      y: this.getTrainRailY(),
    };
  }

  private updateCargoSafety(deltaMs: number): void {
    for (const cargo of this.cargoBodies) {
      this.limitBodyVelocity(cargo, CARGO_MAX_SPEED);
      this.dampenAngularVelocity(cargo, CARGO_MAX_ANGULAR_SPEED);

      if (this.cargoRecoveryTargets.has(cargo)) {
        this.moveCargoToRecoveryTarget(cargo, deltaMs);
        continue;
      }

      const position = cargo.position;
      const isOutOfBounds =
        position.x < -70 ||
        position.x > this.getWorldWidth() + 70 ||
        position.y < -70 ||
        position.y > this.getWorldHeight() + 70;
      const isInverted = Math.abs(cargo.angle) > Math.PI * 0.75;

      if (isOutOfBounds || isInverted) {
        this.beginCargoRecovery(cargo);
      }
    }

    if (this.cargoRecoveryActive && this.cargoRecoveryTargets.size === 0) {
      this.cargoRecoveryActive = false;
      this.onFeedback?.("cargo-recovered");
      this.onStateChange(this.truckPhase);
    }
  }

  private beginCargoRecovery(cargo: MatterJS.BodyType): void {
    if (this.grabbedCargo === cargo) {
      this.grabbedCargo = undefined;
      this.grabPointerId = undefined;
    }

    cargo.ignoreGravity = true;
    this.wakeBody(cargo);
    this.matter.body.setVelocity(cargo, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(cargo, 0);
    const target = this.getSafeCargoPosition(this.cargoBodies.indexOf(cargo));
    this.cargoRecoveryTargets.set(cargo, target);
    this.resetMotionWatch(cargo, target);
    if (!this.cargoRecoveryActive) {
      this.cargoRecoveryActive = true;
      this.onStateChange("recovering");
    }
  }

  private moveCargoToRecoveryTarget(cargo: MatterJS.BodyType, deltaMs: number): void {
    const target = this.cargoRecoveryTargets.get(cargo);
    if (!target) {
      return;
    }

    const step = stepGuidedMotion(
      {
        position: cargo.position,
        velocity: cargo.velocity,
      },
      target,
      CARGO_RECOVERY_GUIDED_PROFILE,
      deltaMs,
    );
    this.wakeBody(cargo);
    this.matter.body.setVelocity(cargo, step.velocity);
    this.dampenAngularVelocity(cargo, CARGO_MAX_ANGULAR_SPEED);

    if (step.arrived) {
      this.matter.body.setPosition(cargo, target);
      this.matter.body.setVelocity(cargo, { x: 0, y: 0 });
      cargo.ignoreGravity = false;
      cargo.isSensor = false;
      this.matter.body.setAngularVelocity(cargo, 0);
      this.cargoRecoveryTargets.delete(cargo);
      return;
    }
  }

  private updateCargoVisuals(): void {
    for (const cargo of this.cargoBodies) {
      this.cargoVisuals.get(cargo)?.setPosition(cargo.position.x, cargo.position.y).setRotation(cargo.angle);
    }
  }

  private updateTrainVisuals(deltaMs: number): void {
    if (this.trainBody) {
      const activeScale = this.activeVehicle === "train" ? this.getActiveVehicleVisualScale() : 0.78;
      this.trainVisual
        ?.setPosition(this.trainBody.position.x, this.trainBody.position.y)
        .setRotation(this.trainBody.angle * (this.reducedMotion ? 0.08 : 0.2))
        .setScale(activeScale)
        .setAlpha(this.activeVehicle === "train" ? 1 : 0.68);
      const speed = this.trainBody.velocity.x;
      const frameScale = deltaMs / 16.67;
      if (this.trainVisual) {
        for (const wheel of this.trainWheelVisuals.get(this.trainVisual) ?? []) {
          wheel.rotation += speed * 0.035 * frameScale;
        }
      }
    }

    for (const carriage of this.trainCarriageBodies) {
      this.trainCarriageVisuals
        .get(carriage)
        ?.setPosition(carriage.position.x, carriage.position.y)
        .setRotation(carriage.angle * (this.reducedMotion ? 0.15 : 0.45))
        .setScale(this.activeVehicle === "train" ? this.getActiveVehicleVisualScale() : 0.78)
        .setAlpha(this.activeVehicle === "train" ? 0.98 : 0.64);
      const speed = carriage.velocity.x;
      const frameScale = deltaMs / 16.67;
      const visual = this.trainCarriageVisuals.get(carriage);
      if (visual) {
        for (const wheel of this.trainWheelVisuals.get(visual) ?? []) {
          wheel.rotation += speed * 0.035 * frameScale;
        }
      }
    }
  }

  private getTrainBodies(): MatterJS.BodyType[] {
    return this.trainBody ? [this.trainBody, ...this.trainCarriageBodies] : [];
  }

  private getTrainState(): DepotTenangState {
    if (this.trainPhase === "ready") {
      return "ready";
    }

    if (this.trainPhase === "moving") {
      return "train-moving";
    }

    if (this.trainPhase === "station") {
      return "train-station";
    }

    if (this.trainPhase === "returning") {
      return "train-returning";
    }

    return "train-quiet";
  }

  private wakeTrainBodies(): void {
    for (const trainBody of this.getTrainBodies()) {
      this.wakeBody(trainBody);
    }
  }

  private syncLoadedCargo(deltaMs: number): void {
    if (!this.truckBody) {
      return;
    }

    const cargoOffsets = [
      { x: -22, y: -40 },
      { x: 22, y: -40 },
      { x: 0, y: -68 },
    ];

    for (const [index, cargo] of this.cargoBodies.entries()) {
      const offset = cargoOffsets[index] ?? cargoOffsets[0];
      const target = {
        x: this.truckBody.position.x + offset.x,
        y: this.truckBody.position.y + offset.y,
      };
      const step = stepGuidedMotion(
        {
          position: cargo.position,
          velocity: cargo.velocity,
        },
        target,
        CARGO_LOAD_GUIDED_PROFILE,
        deltaMs,
      );
      this.wakeBody(cargo);
      this.matter.body.setVelocity(cargo, step.velocity);
      this.dampenAngularVelocity(cargo, CARGO_MAX_ANGULAR_SPEED);
    }
  }

  private clearCargo(): void {
    for (const cargo of this.cargoBodies) {
      this.matter.world.remove(cargo);
      this.cargoVisuals.get(cargo)?.destroy();
    }

    this.cargoBodies = [];
    this.cargoVisuals.clear();
    this.cargoRecoveryTargets.clear();
    this.cargoRecoveryActive = false;
    this.grabbedCargo = undefined;
    this.grabPointerId = undefined;
  }

  private getTruckArrivalPoint(): { x: number; y: number } {
    return {
      x: this.getWorldWidth() * TRUCK_ARRIVAL_RATIO,
      y: ROAD_Y - TRUCK_HEIGHT / 2,
    };
  }

  private getTrainArrivalPoint(): { x: number; y: number } {
    return {
      x: this.getWorldWidth() * TRAIN_ARRIVAL_RATIO,
      y: this.getTrainRailY(),
    };
  }

  private getWorldWidth(): number {
    return Math.max(this.scale.width, WORLD_WIDTH);
  }

  private getWorldHeight(): number {
    return Math.max(this.scale.height, WORLD_HEIGHT);
  }

  private getActiveVehicleVisualScale(): number {
    return this.clamp(1 + (this.getWorldWidth() - WORLD_WIDTH) / 1_150, 1, 1.62);
  }

  private getTruckStartingPoint(): { x: number; y: number } {
    return {
      x: this.getWorldWidth() * TRUCK_START_RATIO,
      y: ROAD_Y - TRUCK_HEIGHT / 2,
    };
  }

  private getTrainStartingPoint(): { x: number; y: number } {
    return {
      x: this.getWorldWidth() * TRAIN_START_RATIO,
      y: this.getTrainRailY(),
    };
  }

  private getTrainRailY(): number {
    const roadY = Math.min(ROAD_Y, this.getWorldHeight() * 0.75);
    return roadY - 96 + 23;
  }

  private getTrainCarriagePosition(anchor: { x: number; y: number }, index: number): { x: number; y: number } {
    return {
      x: anchor.x - TRAIN_CARRIAGE_GAP * (index + 1),
      y: anchor.y,
    };
  }

  private getSafeCargoPosition(index: number): { x: number; y: number } {
    const arrivalPoint = this.getTruckArrivalPoint();
    const safePositions = [
      { x: arrivalPoint.x - 22, y: arrivalPoint.y - 40 },
      { x: arrivalPoint.x + 22, y: arrivalPoint.y - 40 },
      { x: arrivalPoint.x, y: arrivalPoint.y - 68 },
    ];
    return safePositions[index] ?? safePositions[0];
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
  }

  private dampenAngularVelocity(body: MatterJS.BodyType, maximum: number): void {
    const angularVelocity = body.angularVelocity;
    const dampedVelocity = Math.abs(angularVelocity) <= 0.001 ? 0 : angularVelocity * 0.72;
    const safeVelocity = this.clamp(dampedVelocity, -maximum, maximum);
    if (safeVelocity !== angularVelocity) {
      this.matter.body.setAngularVelocity(body, safeVelocity);
    }
  }

  private limitBodyVelocity(body: MatterJS.BodyType, maximum: number): void {
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed <= maximum || speed === 0) {
      return;
    }

    const scale = maximum / speed;
    this.matter.body.setVelocity(body, {
      x: body.velocity.x * scale,
      y: body.velocity.y * scale,
    });
  }

  private getPhysicsImpulseScale(): number {
    return this.reducedMotion ? 0.55 : 1;
  }

  private wakeBody(body: MatterJS.BodyType): void {
    body.isSleeping = false;
    (body as MatterJS.BodyType & { sleepCounter: number }).sleepCounter = 0;
  }
}
