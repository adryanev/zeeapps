import Phaser from "phaser";

export type DepotTenangState =
  | "ready"
  | "moving"
  | "cargo"
  | "returning"
  | "quiet"
  | "recovering";

export type DepotTenangFeedback =
  | "cargo-grabbed"
  | "cargo-released"
  | "cargo-recovered"
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
};

export class DepotTenangScene extends Phaser.Scene {
  private readonly onStateChange: (state: DepotTenangState) => void;
  private readonly onFeedback?: (feedback: DepotTenangFeedback) => void;
  private readonly onActionAccepted?: () => void;
  private readonly reducedMotion: boolean;
  private diorama?: Phaser.GameObjects.Graphics;
  private depotLabels: Phaser.GameObjects.Text[] = [];
  private truckVisual?: Phaser.GameObjects.Container;
  private truckBody?: MatterJS.BodyType;
  private cargoBodies: MatterJS.BodyType[] = [];
  private cargoVisuals = new Map<MatterJS.BodyType, Phaser.GameObjects.Rectangle>();
  private cargoRecoveryTargets = new Map<MatterJS.BodyType, { x: number; y: number }>();
  private cargoRecoveryLastMovedAt = new Map<MatterJS.BodyType, number>();
  private truckPhase: DepotTenangState = "ready";
  private grabbedCargo?: MatterJS.BodyType;
  private grabPointerId?: number;
  private grabTarget = { x: 0, y: 0 };
  private grabStart = { x: 0, y: 0 };
  private grabStartedAt = 0;
  private truckRecoveryTarget?: { x: number; y: number };
  private cargoRecoveryActive = false;
  private lastTruckMovementAt = 0;

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

    this.truckVisual.setPosition(this.truckBody.position.x, this.truckBody.position.y);
    this.truckVisual.setRotation(this.truckBody.angle * (this.reducedMotion ? 0.08 : 0.2));

    if (this.truckPhase === "moving" && this.truckBody.position.x >= this.getTruckArrivalPoint().x) {
      this.settleTruckAtArrival();
    }

    if (this.truckPhase === "returning" && this.truckBody.position.x <= this.getTruckStartingPoint().x) {
      this.settleTruckAtGarage();
    }

    if (this.truckPhase === "returning" || this.truckPhase === "quiet") {
      this.syncLoadedCargo();
    }

    this.updateCargoVisuals();
  }

  private updateTruckJourneyMovement(): void {
    if (!this.truckBody || (this.truckPhase !== "moving" && this.truckPhase !== "returning")) {
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

    this.advanceTruckJourney();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.grabbedCargo || this.cargoRecoveryActive || this.truckRecoveryTarget) {
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
    if (!this.grabbedCargo || this.grabPointerId !== pointer.id) {
      return;
    }

    this.grabTarget.x = pointer.x;
    this.grabTarget.y = pointer.y;
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.grabbedCargo || this.grabPointerId !== pointer.id) {
      return;
    }

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

  private startTruckJourney(): void {
    if (!this.truckBody) {
      return;
    }

    this.truckPhase = "moving";
    this.lastTruckMovementAt = this.time.now;
    this.wakeBody(this.truckBody);
    this.matter.body.setVelocity(this.truckBody, { x: TRUCK_SPEED, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
    this.onActionAccepted?.();
    this.onStateChange("moving");
  }

  private startTruckReturn(): void {
    if (!this.truckBody) {
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
    this.onStateChange("quiet");
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

  private findCargoAt(x: number, y: number): MatterJS.BodyType | undefined {
    return this.cargoBodies.find((cargo) => {
      const distance = Math.hypot(cargo.position.x - x, cargo.position.y - y);
      return distance <= CARGO_GRAB_RADIUS;
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
