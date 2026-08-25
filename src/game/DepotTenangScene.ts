import Phaser from "phaser";

export type DepotTenangState =
  | "ready"
  | "moving"
  | "cargo"
  | "returning"
  | "quiet"
  | "recovering"
  | "train-moving"
  | "train-station"
  | "train-returning"
  | "train-quiet"
  | "train-recovering";

export type DepotTenangFeedback =
  | "cargo-grabbed"
  | "cargo-released"
  | "cargo-recovered"
  | "train-grabbed"
  | "train-released"
  | "train-recovered"
  | "quiet-response";

type DepotTenangCallbacks = {
  onStateChange: (state: DepotTenangState) => void;
  onFeedback?: (feedback: DepotTenangFeedback) => void;
  onActionAccepted?: () => void;
  reducedMotion?: boolean;
};

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const ROAD_Y = 394;
const TRUCK_WIDTH = 138;
const TRUCK_HEIGHT = 52;
const TRUCK_SPEED = 3.6;
const TRUCK_MAX_SPEED = 4.2;
const CARGO_WIDTH = 34;
const CARGO_HEIGHT = 28;
const CARGO_MAX_SPEED = 7;
const CARGO_MAX_ANGULAR_SPEED = 0.14;
const CARGO_GRAB_RADIUS = 68;
const CARGO_RECOVERY_SPEED = 180;
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
const TRAIN_RECOVERY_SPEED = 160;
const TRAIN_TRACK_MARGIN = 84;
const COLORS = {
  sky: 0xb8d9dc,
  skyLight: 0xdff0ed,
  hill: 0x9dc1a7,
  ground: 0xd7c39f,
  road: 0x6c7881,
  roadEdge: 0x53616b,
  rail: 0x6e5c52,
  railMetal: 0xd4b879,
  depot: 0xf1e4cf,
  depotShadow: 0xb79473,
  ink: 0x35444c,
  truck: 0xdd7860,
  truckDark: 0x9b4d46,
  truckWindow: 0xa7d6d9,
  wheel: 0x34424a,
  train: 0x7392a3,
  trainDark: 0x476473,
  trainWindow: 0xc3e0de,
  carriage: 0xd8a85d,
};

type ActiveVehicle = "none" | "truck" | "train";
type TrainPhase = "ready" | "moving" | "station" | "returning" | "quiet";

export class DepotTenangScene extends Phaser.Scene {
  private readonly onStateChange: (state: DepotTenangState) => void;
  private readonly onFeedback?: (feedback: DepotTenangFeedback) => void;
  private readonly onActionAccepted?: () => void;
  private readonly reducedMotion: boolean;
  private diorama?: Phaser.GameObjects.Graphics;
  private depotLabels: Phaser.GameObjects.Text[] = [];
  private truckVisual?: Phaser.GameObjects.Container;
  private truckBody?: MatterJS.BodyType;
  private trainVisual?: Phaser.GameObjects.Container;
  private trainBody?: MatterJS.BodyType;
  private trainCarriageBodies: MatterJS.BodyType[] = [];
  private trainCarriageVisuals = new Map<MatterJS.BodyType, Phaser.GameObjects.Container>();
  private trainConstraints: MatterJS.ConstraintType[] = [];
  private cargoBodies: MatterJS.BodyType[] = [];
  private cargoVisuals = new Map<MatterJS.BodyType, Phaser.GameObjects.Rectangle>();
  private cargoRecoveryTargets = new Map<MatterJS.BodyType, { x: number; y: number }>();
  private cargoRecoveryLastMovedAt = new Map<MatterJS.BodyType, number>();
  private truckPhase: DepotTenangState = "ready";
  private trainPhase: TrainPhase = "ready";
  private activeVehicle: ActiveVehicle = "none";
  private grabbedCargo?: MatterJS.BodyType;
  private grabPointerId?: number;
  private grabTarget = { x: 0, y: 0 };
  private grabStart = { x: 0, y: 0 };
  private grabStartedAt = 0;
  private truckRecoveryTarget?: { x: number; y: number };
  private cargoRecoveryActive = false;
  private lastTruckMovementAt = 0;
  private trainGrabbedBody?: MatterJS.BodyType;
  private trainGrabPointerId?: number;
  private trainGrabTarget = { x: 0, y: 0 };
  private trainGrabStart = { x: 0, y: 0 };
  private trainGrabStartedAt = 0;
  private trainRecoveryTargets = new Map<MatterJS.BodyType, { x: number; y: number }>();
  private trainRecoveryLastMovedAt = new Map<MatterJS.BodyType, number>();
  private trainRecoveryActive = false;
  private lastTrainMovementAt = 0;

  public constructor(callbacks: DepotTenangCallbacks) {
    super({ key: "DepotTenangScene" });
    this.onStateChange = callbacks.onStateChange;
    this.onFeedback = callbacks.onFeedback;
    this.onActionAccepted = callbacks.onActionAccepted;
    this.reducedMotion = callbacks.reducedMotion ?? false;
  }

  public create(): void {
    this.diorama = this.add.graphics();
    this.createMatterBounds();
    this.createTruck();
    this.createTrain();
    this.createRestingPlaceLabels();
    this.layoutDiorama();

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);
    this.input.keyboard?.on("keydown", this.handleKeyboard, this);
    this.input.keyboard?.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
    this.scale.on("resize", this.handleResize, this);

    this.onStateChange("ready");
  }

  public update(): void {
    if (!this.truckBody || !this.truckVisual) {
      return;
    }

    this.updateTruckSafety();
    this.updateCargoSafety();
    this.updateGrabbedCargo();
    this.updateTruckJourneyMovement();
    this.updateTrainSafety();
    this.updateGrabbedTrain();
    this.updateTrainJourneyMovement();

    this.truckVisual.setPosition(this.truckBody.position.x, this.truckBody.position.y);
    this.truckVisual.setRotation(this.truckBody.angle * (this.reducedMotion ? 0.08 : 0.2));

    this.updateTrainVisuals();

    if (this.truckPhase === "moving" && this.truckBody.position.x >= this.getTruckArrivalPoint().x) {
      this.settleTruckAtArrival();
    }

    if (this.truckPhase === "returning" && this.truckBody.position.x <= this.getTruckStartingPoint().x) {
      this.settleTruckAtGarage();
    }

    if (
      this.trainBody &&
      this.trainPhase === "moving" &&
      this.trainBody.position.x <= this.getTrainArrivalPoint().x
    ) {
      this.settleTrainAtStation();
    }

    if (
      this.trainBody &&
      this.trainPhase === "returning" &&
      this.trainBody.position.x >= this.getTrainStartingPoint().x
    ) {
      this.settleTrainAtDepot();
    }

    if (this.truckPhase === "returning" || this.truckPhase === "quiet") {
      this.syncLoadedCargo();
    }

    this.updateCargoVisuals();
  }

  private updateTruckJourneyMovement(): void {
    if (
      !this.truckBody ||
      this.activeVehicle !== "truck" ||
      (this.truckPhase !== "moving" && this.truckPhase !== "returning")
    ) {
      return;
    }

    const destination = this.truckPhase === "moving" ? this.getTruckArrivalPoint() : this.getTruckStartingPoint();
    const direction = this.truckPhase === "moving" ? 1 : -1;
    const now = this.time.now;
    const elapsed = this.lastTruckMovementAt === 0 ? 16.67 : this.clamp(now - this.lastTruckMovementAt, 0, 120);
    this.lastTruckMovementAt = now;
    const nextX = this.truckBody.position.x + direction * TRUCK_SPEED * (elapsed / 16.67);
    const hasReachedDestination = direction > 0 ? nextX >= destination.x : nextX <= destination.x;
    this.wakeBody(this.truckBody);
    this.matter.body.setPosition(this.truckBody, {
      x: hasReachedDestination ? destination.x : nextX,
      y: destination.y,
    });
    this.matter.body.setVelocity(this.truckBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
  }

  private updateTrainJourneyMovement(): void {
    if (
      !this.trainBody ||
      this.activeVehicle !== "train" ||
      this.trainRecoveryActive ||
      (this.trainPhase !== "moving" && this.trainPhase !== "returning")
    ) {
      return;
    }

    const destination =
      this.trainPhase === "moving" ? this.getTrainArrivalPoint() : this.getTrainStartingPoint();
    const direction = this.trainPhase === "moving" ? -1 : 1;
    const now = this.time.now;
    const elapsed = this.lastTrainMovementAt === 0 ? 16.67 : this.clamp(now - this.lastTrainMovementAt, 0, 120);
    this.lastTrainMovementAt = now;
    const nextX = this.trainBody.position.x + direction * TRAIN_SPEED * (elapsed / 16.67);
    const hasReachedDestination = direction < 0 ? nextX <= destination.x : nextX >= destination.x;
    this.wakeTrainBodies();
    this.matter.body.setPosition(this.trainBody, {
      x: hasReachedDestination ? destination.x : nextX,
      y: this.getTrainRailY(),
    });
    this.matter.body.setVelocity(this.trainBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.trainBody, 0);
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
      friction: 0.9,
      frictionAir: 0.18,
      restitution: 0.05,
      label: "active-truck",
    });

    this.truckVisual = this.add.container(startingPoint.x, startingPoint.y);
    this.truckVisual.setDepth(10);
    this.truckVisual.add([
      this.add.ellipse(0, 30, 144, 15, 0x3f4b4b, 0.18),
      this.add.rectangle(-4, 0, 132, 48, COLORS.truck).setStrokeStyle(3, COLORS.truckDark),
      this.add.rectangle(42, -6, 42, 36, COLORS.truckDark).setStrokeStyle(3, COLORS.truckDark),
      this.add.rectangle(48, -4, 25, 17, COLORS.truckWindow).setStrokeStyle(2, COLORS.ink),
      this.add.circle(-42, 28, 14, COLORS.wheel),
      this.add.circle(41, 28, 14, COLORS.wheel),
      this.add.circle(-42, 28, 5, 0xd9c99e),
      this.add.circle(41, 28, 5, 0xd9c99e),
      this.add.text(-5, -10, "TRUK", {
        color: "#fff6e7",
        fontFamily: "Nunito, Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
      }).setOrigin(0.5),
    ]);
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
        friction: 0.82,
        frictionAir: 0.12,
        restitution: 0.02,
        label: "active-train",
      },
    );

    this.trainVisual = this.add.container(startingPoint.x, startingPoint.y);
    this.trainVisual.setDepth(9);
    this.trainVisual.add([
      this.add.ellipse(0, 25, 104, 12, 0x3f4b4b, 0.18),
      this.add.rectangle(0, 0, 88, 31, COLORS.train).setStrokeStyle(3, COLORS.trainDark),
      this.add.rectangle(-29, -5, 24, 20, COLORS.trainDark).setStrokeStyle(2, COLORS.ink),
      this.add.rectangle(-30, -4, 15, 11, COLORS.trainWindow).setStrokeStyle(1, COLORS.ink),
      this.add.circle(-30, 18, 8, COLORS.wheel),
      this.add.circle(30, 18, 8, COLORS.wheel),
      this.add.circle(-30, 18, 3, 0xd9c99e),
      this.add.circle(30, 18, 3, 0xd9c99e),
      this.add.text(10, -8, "KERETA", {
        color: "#fff6e7",
        fontFamily: "Nunito, Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
      }).setOrigin(0.5),
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
          friction: 0.82,
          frictionAir: 0.13,
          restitution: 0.02,
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

  private createTrainCarriageVisual(index: number): Phaser.GameObjects.Container {
    const visual = this.add.container(0, 0);
    visual.setDepth(9);
    visual.add([
      this.add.ellipse(0, 22, 78, 10, 0x3f4b4b, 0.16),
      this.add.rectangle(0, 0, TRAIN_CARRIAGE_WIDTH, TRAIN_CARRIAGE_HEIGHT, COLORS.carriage).setStrokeStyle(
        3,
        COLORS.trainDark,
      ),
      this.add.rectangle(-20, -2, 13, 11, COLORS.trainWindow).setStrokeStyle(1, COLORS.ink),
      this.add.rectangle(2, -2, 13, 11, COLORS.trainWindow).setStrokeStyle(1, COLORS.ink),
      this.add.rectangle(24, -2, 13, 11, COLORS.trainWindow).setStrokeStyle(1, COLORS.ink),
      this.add.circle(-22, 17, 7, COLORS.wheel),
      this.add.circle(22, 17, 7, COLORS.wheel),
      this.add.text(0, -18, `V${index + 1}`, {
        color: "#fff6e7",
        fontFamily: "Nunito, Arial, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
      }).setOrigin(0.5),
    ]);
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
        friction: 0.85,
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

  private createRestingPlaceLabels(): void {
    this.depotLabels = [
      this.createLabel("GARASI", COLORS.truckDark),
      this.createLabel("STASIUN", COLORS.rail),
      this.createLabel("HANGAR", COLORS.depotShadow),
      this.createLabel("DEPO KERETA", COLORS.trainDark),
    ];
  }

  private createLabel(label: string, color: number): Phaser.GameObjects.Text {
    return this.add.text(0, 0, label, {
      backgroundColor: `#${color.toString(16).padStart(6, "0")}`,
      color: "#fff6e7",
      fontFamily: "Nunito, Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      padding: { left: 12, right: 12, top: 7, bottom: 7 },
    }).setOrigin(0.5).setDepth(8);
  }

  private layoutDiorama(): void {
    if (!this.diorama) {
      return;
    }

    const width = this.getWorldWidth();
    const height = this.getWorldHeight();
    const roadY = Math.min(ROAD_Y, height * 0.75);
    const railY = roadY - 96;
    const skyLine = height * 0.54;

    this.diorama.clear();
    this.diorama.fillStyle(COLORS.sky, 1).fillRect(0, 0, width, height);
    this.diorama.fillStyle(COLORS.skyLight, 0.75).fillCircle(width * 0.8, height * 0.2, 62);
    this.diorama.fillStyle(COLORS.skyLight, 0.8).fillCircle(width * 0.24, height * 0.24, 28);
    this.diorama.fillStyle(COLORS.skyLight, 0.8).fillCircle(width * 0.29, height * 0.23, 36);
    this.diorama.fillStyle(COLORS.hill, 1).fillTriangle(0, skyLine + 64, width * 0.22, skyLine - 30, width * 0.48, skyLine + 64);
    this.diorama.fillStyle(0x82ac93, 1).fillTriangle(width * 0.32, skyLine + 64, width * 0.64, skyLine - 50, width, skyLine + 64);
    this.diorama.fillStyle(COLORS.ground, 1).fillRect(0, skyLine + 48, width, height - skyLine - 48);

    this.drawHangar(width * 0.83, railY - 55);
    this.drawStation(width * 0.53, railY - 38);
    this.drawGarage(width * 0.13, roadY - 58);
    this.drawRail(width, railY);
    this.drawRoad(width, roadY);
    this.drawDioramaFrame(width, height);

    this.positionLabel(this.depotLabels[0], width * 0.13, roadY - 110);
    this.positionLabel(this.depotLabels[1], width * 0.53, railY - 92);
    this.positionLabel(this.depotLabels[2], width * 0.83, railY - 143);
    this.positionLabel(this.depotLabels[3], width * TRAIN_START_RATIO, railY - 70);
  }

  private drawRoad(width: number, roadY: number): void {
    this.diorama?.fillStyle(COLORS.roadEdge, 1).fillRect(0, roadY - 4, width, 70);
    this.diorama?.fillStyle(COLORS.road, 1).fillRect(0, roadY, width, 62);

    for (let x = 22; x < width; x += 104) {
      this.diorama?.fillStyle(0xe5d39e, 0.88).fillRect(x, roadY + 27, 54, 6);
    }
  }

  private drawRail(width: number, railY: number): void {
    this.diorama?.fillStyle(COLORS.rail, 1).fillRect(0, railY, width, 9);
    this.diorama?.fillStyle(COLORS.rail, 1).fillRect(0, railY + 39, width, 9);
    this.diorama?.fillStyle(COLORS.railMetal, 1).fillRect(0, railY + 3, width, 3);
    this.diorama?.fillStyle(COLORS.railMetal, 1).fillRect(0, railY + 42, width, 3);

    for (let x = 18; x < width; x += 48) {
      this.diorama?.fillStyle(COLORS.rail, 1).fillRect(x, railY - 9, 9, 66);
    }
  }

  private drawGarage(x: number, y: number): void {
    this.diorama?.fillStyle(COLORS.depotShadow, 1).fillRect(x - 74, y, 148, 87);
    this.diorama?.fillStyle(COLORS.depot, 1).fillRect(x - 64, y + 10, 128, 77);
    this.diorama?.fillStyle(COLORS.truckDark, 1).fillTriangle(x - 80, y + 10, x, y - 44, x + 80, y + 10);
    this.diorama?.fillStyle(COLORS.ink, 1).fillRect(x - 30, y + 34, 60, 53);
  }

  private drawStation(x: number, y: number): void {
    this.diorama?.fillStyle(COLORS.depotShadow, 1).fillRect(x - 72, y, 144, 74);
    this.diorama?.fillStyle(COLORS.depot, 1).fillRect(x - 62, y + 10, 124, 64);
    this.diorama?.fillStyle(COLORS.rail, 1).fillTriangle(x - 78, y + 10, x, y - 38, x + 78, y + 10);
    this.diorama?.fillStyle(COLORS.railMetal, 1).fillRect(x - 42, y + 34, 84, 7);
  }

  private drawHangar(x: number, y: number): void {
    this.diorama?.fillStyle(COLORS.depotShadow, 1).fillRect(x - 76, y, 152, 86);
    this.diorama?.fillStyle(COLORS.depot, 1).fillRect(x - 66, y + 10, 132, 76);
    this.diorama?.fillStyle(COLORS.depotShadow, 1).fillTriangle(x - 82, y + 10, x, y - 50, x + 82, y + 10);
    this.diorama?.fillStyle(COLORS.sky, 1).fillRect(x - 47, y + 38, 94, 48);
  }

  private drawDioramaFrame(width: number, height: number): void {
    this.diorama?.lineStyle(5, COLORS.ink, 0.22).strokeRect(14, 14, width - 28, height - 28);
  }

  private positionLabel(label: Phaser.GameObjects.Text | undefined, x: number, y: number): void {
    label?.setPosition(x, y);
  }

  private handleResize(): void {
    this.layoutDiorama();
  }

  private handleKeyboard(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    this.advanceJourney();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (
      this.grabbedCargo ||
      this.cargoRecoveryActive ||
      this.truckRecoveryTarget ||
      this.trainGrabbedBody ||
      this.trainRecoveryActive
    ) {
      return;
    }

    if (this.activeVehicle === "train") {
      const trainBody = this.findTrainBodyAt(pointer.x, pointer.y);
      if (trainBody && this.trainPhase !== "quiet") {
        this.beginTrainGrab(trainBody, pointer);
        return;
      }
    }

    if (
      this.activeVehicle === "none" &&
      this.trainPhase === "ready" &&
      this.findTrainBodyAt(pointer.x, pointer.y)
    ) {
      this.startTrainJourney();
      return;
    }

    if (this.truckPhase === "cargo") {
      const cargo = this.findCargoAt(pointer.x, pointer.y);

      if (cargo) {
        this.beginCargoGrab(cargo, pointer);
        return;
      }
    }

    this.advanceTruckJourney();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.grabbedCargo && this.grabPointerId === pointer.id) {
      this.grabTarget.x = pointer.x;
      this.grabTarget.y = pointer.y;
      return;
    }

    if (this.trainGrabbedBody && this.trainGrabPointerId === pointer.id) {
      this.trainGrabTarget.x = pointer.x;
      this.trainGrabTarget.y = pointer.y;
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.grabbedCargo && this.grabPointerId === pointer.id) {
      const releasedCargo = this.grabbedCargo;
      const elapsed = Math.max(this.time.now - this.grabStartedAt, 1);
      const impulseScale = this.getPhysicsImpulseScale();
      const swipeVelocity = {
        x: this.clamp(
          (pointer.x - this.grabStart.x) / elapsed * 8 * impulseScale,
          -CARGO_MAX_SPEED,
          CARGO_MAX_SPEED,
        ),
        y: this.clamp(
          (pointer.y - this.grabStart.y) / elapsed * 8 * impulseScale,
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

    if (!this.trainGrabbedBody || this.trainGrabPointerId !== pointer.id) {
      return;
    }

    const releasedTrainBody = this.trainGrabbedBody;
    const elapsed = Math.max(this.time.now - this.trainGrabStartedAt, 1);
    const impulseScale = this.getPhysicsImpulseScale();
    const swipeVelocity = {
      x: this.clamp(
        (pointer.x - this.trainGrabStart.x) / elapsed * 7 * impulseScale,
        -TRAIN_MAX_SPEED,
        TRAIN_MAX_SPEED,
      ),
      y: this.clamp(
        (pointer.y - this.trainGrabStart.y) / elapsed * 7 * impulseScale,
        -TRAIN_MAX_SPEED,
        TRAIN_MAX_SPEED,
      ),
    };
    this.matter.body.setVelocity(releasedTrainBody, swipeVelocity);
    this.matter.body.setAngularVelocity(releasedTrainBody, 0);
    this.onFeedback?.("train-released");
    this.trainGrabbedBody = undefined;
    this.trainGrabPointerId = undefined;
  }

  private advanceJourney(): void {
    if (this.activeVehicle === "truck") {
      this.advanceTruckJourney();
      return;
    }

    if (this.activeVehicle === "train") {
      this.advanceTrainJourney();
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

    if (this.trainPhase === "quiet") {
      this.onFeedback?.("quiet-response");
    }
  }

  private advanceTruckJourney(): void {
    if (this.truckPhase === "ready") {
      this.startTruckJourney();
      return;
    }

    if (this.truckPhase === "cargo" && !this.cargoRecoveryActive) {
      this.startTruckReturn();
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
      this.startTrainReturn();
      return;
    }

    if (this.trainPhase === "quiet") {
      this.onFeedback?.("quiet-response");
    }
  }

  private startTruckJourney(): void {
    if (!this.truckBody || this.activeVehicle !== "none") {
      return;
    }

    this.activeVehicle = "truck";
    this.truckPhase = "moving";
    this.lastTruckMovementAt = this.time.now;
    this.wakeBody(this.truckBody);
    this.matter.body.setVelocity(this.truckBody, { x: TRUCK_SPEED, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
    this.onActionAccepted?.();
    this.onStateChange("moving");
  }

  private startTruckReturn(): void {
    if (!this.truckBody || this.activeVehicle !== "truck") {
      return;
    }

    this.truckPhase = "returning";
    this.lastTruckMovementAt = this.time.now;
    this.wakeBody(this.truckBody);
    this.matter.body.setVelocity(this.truckBody, { x: -TRUCK_SPEED, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
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
    this.clearCargo();
    this.truckPhase = "quiet";
    this.activeVehicle = "none";
    this.onStateChange("quiet");
  }

  private startTrainJourney(): void {
    if (!this.trainBody || this.activeVehicle !== "none" || this.trainPhase !== "ready") {
      return;
    }

    this.activeVehicle = "train";
    this.trainPhase = "moving";
    this.lastTrainMovementAt = this.time.now;
    this.wakeTrainBodies();
    this.matter.body.setVelocity(this.trainBody, { x: -TRAIN_SPEED, y: 0 });
    this.matter.body.setAngularVelocity(this.trainBody, 0);
    this.onActionAccepted?.();
    this.onStateChange("train-moving");
  }

  private startTrainReturn(): void {
    if (!this.trainBody || this.activeVehicle !== "train" || this.trainPhase !== "station") {
      return;
    }

    this.trainPhase = "returning";
    this.lastTrainMovementAt = this.time.now;
    this.wakeTrainBodies();
    this.matter.body.setVelocity(this.trainBody, { x: TRAIN_SPEED, y: 0 });
    this.matter.body.setAngularVelocity(this.trainBody, 0);
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
    this.onStateChange("train-quiet");
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
    this.grabbedCargo = cargo;
    this.grabPointerId = pointer.id;
    this.grabTarget.x = pointer.x;
    this.grabTarget.y = pointer.y;
    this.grabStart.x = pointer.x;
    this.grabStart.y = pointer.y;
    this.grabStartedAt = this.time.now;
    this.matter.body.setAngularVelocity(cargo, 0);
    this.onFeedback?.("cargo-grabbed");
  }

  private beginTrainGrab(trainBody: MatterJS.BodyType, pointer: Phaser.Input.Pointer): void {
    this.trainGrabbedBody = trainBody;
    this.trainGrabPointerId = pointer.id;
    this.trainGrabTarget.x = pointer.x;
    this.trainGrabTarget.y = pointer.y;
    this.trainGrabStart.x = pointer.x;
    this.trainGrabStart.y = pointer.y;
    this.trainGrabStartedAt = this.time.now;
    this.matter.body.setAngularVelocity(trainBody, 0);
    this.onFeedback?.("train-grabbed");
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
      return distance <= TRAIN_GRAB_RADIUS;
    });
  }

  private updateGrabbedCargo(): void {
    if (!this.grabbedCargo || this.cargoRecoveryTargets.has(this.grabbedCargo)) {
      return;
    }

    const pointerTargetIsUnsafe =
      this.grabTarget.x < 30 ||
      this.grabTarget.x > this.getWorldWidth() - 30 ||
      this.grabTarget.y < 30 ||
      this.grabTarget.y > this.getWorldHeight() - 30;
    if (pointerTargetIsUnsafe) {
      this.beginCargoRecovery(this.grabbedCargo);
      return;
    }

    const impulseScale = this.getPhysicsImpulseScale();
    const xVelocity = this.clamp(
      (this.grabTarget.x - this.grabbedCargo.position.x) * 0.16 * impulseScale,
      -CARGO_MAX_SPEED,
      CARGO_MAX_SPEED,
    );
    const yVelocity = this.clamp(
      (this.grabTarget.y - this.grabbedCargo.position.y) * 0.16 * impulseScale,
      -CARGO_MAX_SPEED,
      CARGO_MAX_SPEED,
    );
    this.wakeBody(this.grabbedCargo);
    this.matter.body.setVelocity(this.grabbedCargo, { x: xVelocity, y: yVelocity });
    this.matter.body.setAngularVelocity(
      this.grabbedCargo,
      this.clamp(
        -this.grabbedCargo.angle * 0.12 * impulseScale,
        -CARGO_MAX_ANGULAR_SPEED,
        CARGO_MAX_ANGULAR_SPEED,
      ),
    );
  }

  private updateGrabbedTrain(): void {
    if (!this.trainGrabbedBody || this.trainRecoveryTargets.has(this.trainGrabbedBody)) {
      return;
    }

    const pointerTargetIsUnsafe =
      this.trainGrabTarget.x < 30 ||
      this.trainGrabTarget.x > this.getWorldWidth() - 30 ||
      this.trainGrabTarget.y < 30 ||
      this.trainGrabTarget.y > this.getWorldHeight() - 30;
    if (pointerTargetIsUnsafe) {
      this.beginTrainRecovery();
      return;
    }

    const impulseScale = this.getPhysicsImpulseScale();
    const xVelocity = this.clamp(
      (this.trainGrabTarget.x - this.trainGrabbedBody.position.x) * 0.12 * impulseScale,
      -TRAIN_MAX_SPEED,
      TRAIN_MAX_SPEED,
    );
    const yVelocity = this.clamp(
      (this.trainGrabTarget.y - this.trainGrabbedBody.position.y) * 0.12 * impulseScale,
      -TRAIN_MAX_SPEED,
      TRAIN_MAX_SPEED,
    );
    this.wakeBody(this.trainGrabbedBody);
    this.matter.body.setVelocity(this.trainGrabbedBody, { x: xVelocity, y: yVelocity });
    this.matter.body.setAngularVelocity(
      this.trainGrabbedBody,
      this.clamp(
        -this.trainGrabbedBody.angle * 0.12 * impulseScale,
        -TRAIN_MAX_ANGULAR_SPEED,
        TRAIN_MAX_ANGULAR_SPEED,
      ),
    );
  }

  private updateTruckSafety(): void {
    if (!this.truckBody) {
      return;
    }

    const velocity = this.truckBody.velocity;
    this.matter.body.setVelocity(this.truckBody, {
      x: this.clamp(velocity.x, -TRUCK_MAX_SPEED, TRUCK_MAX_SPEED),
      y: this.clamp(velocity.y, -TRUCK_MAX_SPEED, TRUCK_MAX_SPEED),
    });
    this.matter.body.setAngularVelocity(
      this.truckBody,
      this.clamp(this.truckBody.angularVelocity, -0.08, 0.08),
    );

    const position = this.truckBody.position;
    const isOutOfBounds =
      position.x < -80 ||
      position.x > this.getWorldWidth() + 80 ||
      position.y < -80 ||
      position.y > this.getWorldHeight() + 80;

    if (isOutOfBounds && !this.truckRecoveryTarget) {
      this.truckRecoveryTarget =
        this.truckPhase === "returning" || this.truckPhase === "quiet"
          ? this.getTruckStartingPoint()
          : this.getTruckArrivalPoint();
      this.onStateChange("recovering");
    }

    if (!this.truckRecoveryTarget) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      position.x,
      position.y,
      this.truckRecoveryTarget.x,
      this.truckRecoveryTarget.y,
    );

    if (distance <= 10) {
      this.matter.body.setPosition(this.truckBody, this.truckRecoveryTarget);
      this.matter.body.setVelocity(this.truckBody, { x: 0, y: 0 });
      this.matter.body.setAngularVelocity(this.truckBody, 0);
      this.truckRecoveryTarget = undefined;
      this.onStateChange(this.truckPhase);
      return;
    }

    this.matter.body.setVelocity(this.truckBody, {
      x: this.clamp((this.truckRecoveryTarget.x - position.x) * 0.12, -2, 2),
      y: this.clamp((this.truckRecoveryTarget.y - position.y) * 0.12, -2, 2),
    });
  }

  private updateTrainSafety(): void {
    const trainBodies = this.getTrainBodies();
    if (trainBodies.length === 0) {
      return;
    }

    for (const trainBody of trainBodies) {
      const velocity = trainBody.velocity;
      this.matter.body.setVelocity(trainBody, {
        x: this.clamp(velocity.x, -TRAIN_MAX_SPEED, TRAIN_MAX_SPEED),
        y: this.clamp(velocity.y, -TRAIN_MAX_SPEED, TRAIN_MAX_SPEED),
      });
      this.matter.body.setAngularVelocity(
        trainBody,
        this.clamp(trainBody.angularVelocity, -TRAIN_MAX_ANGULAR_SPEED, TRAIN_MAX_ANGULAR_SPEED),
      );

      if (this.trainRecoveryTargets.has(trainBody)) {
        this.moveTrainToRecoveryTarget(trainBody);
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
    this.trainRecoveryLastMovedAt.clear();
    this.trainRecoveryTargets.set(this.trainBody, anchor);
    for (const [index, carriage] of this.trainCarriageBodies.entries()) {
      this.trainRecoveryTargets.set(carriage, this.getTrainCarriagePosition(anchor, index));
    }
    for (const trainBody of this.getTrainBodies()) {
      this.trainRecoveryLastMovedAt.set(trainBody, this.time.now);
    }
    this.trainRecoveryActive = true;
    this.onStateChange("train-recovering");
  }

  private moveTrainToRecoveryTarget(trainBody: MatterJS.BodyType): void {
    const target = this.trainRecoveryTargets.get(trainBody);
    if (!target) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      trainBody.position.x,
      trainBody.position.y,
      target.x,
      target.y,
    );
    if (distance <= 8) {
      this.matter.body.setPosition(trainBody, target);
      this.matter.body.setVelocity(trainBody, { x: 0, y: 0 });
      this.matter.body.setAngle(trainBody, 0);
      this.matter.body.setAngularVelocity(trainBody, 0);
      this.trainRecoveryTargets.delete(trainBody);
      this.trainRecoveryLastMovedAt.delete(trainBody);
      return;
    }

    const now = this.time.now;
    const lastMovedAt = this.trainRecoveryLastMovedAt.get(trainBody) ?? now;
    const elapsed = this.clamp(now - lastMovedAt, 0, 120);
    this.trainRecoveryLastMovedAt.set(trainBody, now);
    const step = Math.min(TRAIN_RECOVERY_SPEED * (elapsed / 1_000), distance);
    const progress = step / distance;
    this.matter.body.setPosition(trainBody, {
      x: trainBody.position.x + (target.x - trainBody.position.x) * progress,
      y: trainBody.position.y + (target.y - trainBody.position.y) * progress,
    });
    this.matter.body.setVelocity(trainBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(trainBody, this.clamp(-trainBody.angle * 0.14, -0.06, 0.06));
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

  private updateCargoSafety(): void {
    for (const cargo of this.cargoBodies) {
      const velocity = cargo.velocity;
      this.matter.body.setVelocity(cargo, {
        x: this.clamp(velocity.x, -CARGO_MAX_SPEED, CARGO_MAX_SPEED),
        y: this.clamp(velocity.y, -CARGO_MAX_SPEED, CARGO_MAX_SPEED),
      });
      this.matter.body.setAngularVelocity(
        cargo,
        this.clamp(cargo.angularVelocity, -CARGO_MAX_ANGULAR_SPEED, CARGO_MAX_ANGULAR_SPEED),
      );

      if (this.cargoRecoveryTargets.has(cargo)) {
        this.moveCargoToRecoveryTarget(cargo);
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

    this.cargoRecoveryTargets.set(cargo, this.getSafeCargoPosition(this.cargoBodies.indexOf(cargo)));
    this.cargoRecoveryLastMovedAt.set(cargo, this.time.now);
    if (!this.cargoRecoveryActive) {
      this.cargoRecoveryActive = true;
      this.onStateChange("recovering");
    }
  }

  private moveCargoToRecoveryTarget(cargo: MatterJS.BodyType): void {
    const target = this.cargoRecoveryTargets.get(cargo);
    if (!target) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(cargo.position.x, cargo.position.y, target.x, target.y);
    if (distance <= 8) {
      this.matter.body.setPosition(cargo, target);
      this.matter.body.setVelocity(cargo, { x: 0, y: 0 });
      this.matter.body.setAngularVelocity(cargo, 0);
      this.cargoRecoveryTargets.delete(cargo);
      this.cargoRecoveryLastMovedAt.delete(cargo);
      return;
    }

    const now = this.time.now;
    const lastMovedAt = this.cargoRecoveryLastMovedAt.get(cargo) ?? now;
    const elapsed = this.clamp(now - lastMovedAt, 0, 120);
    this.cargoRecoveryLastMovedAt.set(cargo, now);
    const step = Math.min(CARGO_RECOVERY_SPEED * (elapsed / 1_000), distance);
    const progress = step / distance;
    this.matter.body.setPosition(cargo, {
      x: cargo.position.x + (target.x - cargo.position.x) * progress,
      y: cargo.position.y + (target.y - cargo.position.y) * progress,
    });
    this.matter.body.setVelocity(cargo, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(cargo, this.clamp(-cargo.angle * 0.14, -0.08, 0.08));
  }

  private updateCargoVisuals(): void {
    for (const cargo of this.cargoBodies) {
      this.cargoVisuals.get(cargo)?.setPosition(cargo.position.x, cargo.position.y).setRotation(cargo.angle);
    }
  }

  private updateTrainVisuals(): void {
    if (this.trainBody) {
      this.trainVisual
        ?.setPosition(this.trainBody.position.x, this.trainBody.position.y)
        .setRotation(this.trainBody.angle * (this.reducedMotion ? 0.08 : 0.2));
    }

    for (const carriage of this.trainCarriageBodies) {
      this.trainCarriageVisuals
        .get(carriage)
        ?.setPosition(carriage.position.x, carriage.position.y)
        .setRotation(carriage.angle * (this.reducedMotion ? 0.15 : 0.45));
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

  private syncLoadedCargo(): void {
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
      this.matter.body.setPosition(cargo, {
        x: this.truckBody.position.x + offset.x,
        y: this.truckBody.position.y + offset.y,
      });
      this.matter.body.setVelocity(cargo, this.truckBody.velocity);
      this.matter.body.setAngle(cargo, 0);
      this.matter.body.setAngularVelocity(cargo, 0);
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
    this.cargoRecoveryLastMovedAt.clear();
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

  private getPhysicsImpulseScale(): number {
    return this.reducedMotion ? 0.55 : 1;
  }

  private wakeBody(body: MatterJS.BodyType): void {
    body.isSleeping = false;
  }
}
