import Phaser from "phaser";

export type DepotTenangState = "ready" | "moving";

type DepotTenangCallbacks = {
  onStateChange: (state: DepotTenangState) => void;
};

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const ROAD_Y = 394;
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
  private diorama?: Phaser.GameObjects.Graphics;
  private depotLabels: Phaser.GameObjects.Text[] = [];
  private truckVisual?: Phaser.GameObjects.Container;
  private truckBody?: MatterJS.BodyType;
  private truckJourneyStarted = false;
  private truckJourneySettled = false;

  public constructor(callbacks: DepotTenangCallbacks) {
    super({ key: "DepotTenangScene" });
    this.onStateChange = callbacks.onStateChange;
  }

  public create(): void {
    this.diorama = this.add.graphics();
    this.createMatterBounds();
    this.createTruck();
    this.createRestingPlaceLabels();
    this.layoutDiorama();

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.keyboard?.on("keydown", this.handleKeyboard, this);
    this.input.keyboard?.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
    this.scale.on("resize", this.handleResize, this);

    this.onStateChange("ready");
  }

  public update(): void {
    if (!this.truckBody || !this.truckVisual) {
      return;
    }

    this.truckVisual.setPosition(this.truckBody.position.x, this.truckBody.position.y);
    this.truckVisual.setRotation(this.truckBody.angle * 0.2);

    if (!this.truckJourneyStarted || this.truckJourneySettled) {
      return;
    }

    const stopX = this.getWorldWidth() * 0.42;

    if (this.truckBody.position.x < stopX) {
      return;
    }

    this.matter.body.setPosition(this.truckBody, { x: stopX, y: ROAD_Y - 26 });
    this.matter.body.setVelocity(this.truckBody, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(this.truckBody, 0);
    this.truckJourneySettled = true;
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
  }

  private createTruck(): void {
    const startingPoint = this.getTruckStartingPoint();
    this.truckBody = this.matter.add.rectangle(startingPoint.x, startingPoint.y, 138, 52, {
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
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    this.startTruckJourney();
  }

  private handlePointerDown(): void {
    this.startTruckJourney();
  }

  private startTruckJourney(): void {
    if (this.truckJourneyStarted || !this.truckBody) {
      return;
    }

    this.truckJourneyStarted = true;
    this.matter.body.setVelocity(this.truckBody, { x: 3.6, y: 0 });
    this.onStateChange("moving");
  }

  private getWorldWidth(): number {
    return Math.max(this.scale.width, WORLD_WIDTH);
  }

  private getWorldHeight(): number {
    return Math.max(this.scale.height, WORLD_HEIGHT);
  }

  private getTruckStartingPoint(): { x: number; y: number } {
    return {
      x: this.getWorldWidth() * 0.14,
      y: ROAD_Y - 26,
    };
  }
}
