import Phaser from "phaser";
import { FLEET, carriageOffset, rollingAngle } from "./vehicleGeometry";
import { PlayMaterials, preloadPlayMaterials } from "./PlayMaterials";
import type { DepotTenangCallbacks, FreePlaySnapshot, PlayActivity } from "./depotTenangTypes";

const ASSETS = {
  dump: "truck-mining-dump-body", mixer: "truck-mixer-body", tanker: "truck-tanker-body",
  cargo: "truck-body-sol", train: "train-locomotive-sol", carriage: "train-carriage-sol",
  airplane: "airplane-body", wheel: "wheel-sprite", crate: "cargo-crate-sol", propeller: "propeller-sprite",
};
type Toy = { visual: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; wheels: Phaser.GameObjects.Image[]; previousX: number };
type Rock = { image: Phaser.Physics.Matter.Image; state: "track" | "loading" | "bed" | "falling"; from: {x: number; y: number}; progress: number };
const TRUCK_SCALE = 1.65;
const TRUCK_Y = 414 - FLEET.dump.groundContact.y * TRUCK_SCALE;
const RAIL_Y = 213;

/** Direct toy interactions: clear a railway, pour a bridge, and wash an airplane. */
export class DepotTenangScene extends Phaser.Scene {
  private callbacks: DepotTenangCallbacks;
  private activity: PlayActivity = "rocks";
  private paused = false;
  private elapsed = 0;
  private truck!: Toy;
  private truckX = 670;
  private truckSpeed = 0;
  private suspension = 0;
  private suspensionSpeed = 0;
  private truckTarget: number | undefined;
  private tilt = 0;
  private tiltTarget = 0;
  private releaseClock = 0;
  private rocks: Rock[] = [];
  private blocks: Phaser.Physics.Matter.Image[] = [];
  private delivered = 0;
  private train!: Toy;
  private carriages: Toy[] = [];
  private trainBodies: MatterJS.BodyType[] = [];
  private waitingForRocks = false;
  private airplane!: Toy;
  private airplaneShadow!: Phaser.GameObjects.Ellipse;
  private propeller!: Phaser.GameObjects.Image;
  private flight = 0;
  private dirt = [true, true, true, true, true];
  private washTarget: {x: number; y: number} | undefined;
  private sprayTime = 0;
  private bridge = [0, 0, 0];
  private pourTarget: number | undefined;
  private pourQueue: number[] = [];
  private parking = { rocks: 670, build: 670, wash: 670 };
  private cargo!: Toy;
  private cargoX = 70;
  private materials!: PlayMaterials;
  private hints!: Phaser.GameObjects.Graphics;
  private signal!: Phaser.GameObjects.Graphics;
  private railway!: Phaser.GameObjects.Graphics;
  private pit!: Phaser.GameObjects.Graphics;
  private supply!: Phaser.GameObjects.Container;
  private supplyImage!: Phaser.GameObjects.Image;
  private activePointer: number | undefined;
  private pointerStart: {x: number; y: number} | undefined;
  private grabbed: Rock | undefined;
  private grabTarget: {x: number; y: number} | undefined;
  private dragBed = false;
  private lastSnapshot = "";
  private keyDown = (event: KeyboardEvent) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target instanceof HTMLButtonElement) return;
    if ([" ", "Enter", "ArrowRight", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      this.interact();
    }
  };
  private blur = () => this.clearControls();

  constructor(callbacks: DepotTenangCallbacks) {
    super("DepotTenang");
    this.callbacks = callbacks;
  }

  private resizeView = (): void => {
    const {width, height} = this.scale.gameSize;
    this.cameras.main.setSize(width, height).setZoom(width / 960).centerOn(480, 270);
  };

  private worldPointer(p: Phaser.Input.Pointer): Pick<Phaser.Input.Pointer, "id" | "x" | "y"> {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    return {id:p.id, x:world.x, y:world.y};
  }

  preload(): void {
    preloadPlayMaterials(this);
    for (const [key, file] of Object.entries(ASSETS)) this.load.image(key, `${import.meta.env.BASE_URL}assets/depot-tenang-v2/${file}.png`);
    for (const kind of ["mixer", "dump"] as const) {
      const frames = FLEET[kind].animationFrames;
      for (let i = 1; i < frames; i++) this.load.image(`${kind}-${i}`, `${import.meta.env.BASE_URL}assets/depot-tenang-v2/${ASSETS[kind]}-${i}.png`);
    }
  }

  create(): void {
    this.resizeView();
    this.scale.on("resize", this.resizeView);
    this.drawWorld();
    this.matter.add.rectangle(480, 464, 960, 38, {isStatic: true, collisionFilter: {category: 2, mask: 4}});
    for (const x of [8, 952]) this.matter.add.rectangle(x, 270, 16, 540, {isStatic: true, collisionFilter: {category: 2, mask: 4}});
    this.truck = this.makeToy("dump", FLEET.dump, TRUCK_SCALE, 15);
    this.train = this.makeToy("train", FLEET.train, 1, 5);
    this.carriages = [this.makeToy("carriage", FLEET.carriage, 1, 5), this.makeToy("carriage", FLEET.carriage, 1, 5)];
    for (let i = 0; i < 3; i++) {
      const model = i === 0 ? FLEET.train : FLEET.carriage;
      const offset = i === 0 ? {x: 0, y: 0} : carriageOffset(i - 1);
      const body = this.matter.add.rectangle(390 + offset.x, RAIL_Y - model.railContact.y, 100, 40, {
        ignoreGravity: true, frictionAir: 0.03, collisionFilter: {category: 8, mask: 0},
      });
      this.matter.body.setInertia(body, Infinity);
      this.trainBodies.push(body);
      if (i) {
        const ahead = i === 1 ? FLEET.train : FLEET.carriage;
        this.matter.add.constraint(this.trainBodies[i - 1], body, 6, 1, {pointA: {...ahead.couplerRear}, pointB: {...model.couplerFront}, damping: 0.3, angularStiffness: 1});
      }
    }
    this.airplane = this.makeToy("airplane", FLEET.airplane, 0.75, 12);
    this.airplaneShadow = this.add.ellipse(285, 399, 168, 22, 0x496b58, 0.18).setDepth(11);
    this.propeller = this.add.image(0, 0, "propeller").setDisplaySize(70, 70);
    this.airplane.visual.add(this.add.container(FLEET.airplane.propeller.x, FLEET.airplane.propeller.y, [this.propeller]).setScale(0.22, 0.91));
    this.cargo = this.makeToy("cargo", FLEET.cargo, 0.6, 14);
    this.cargo.visual.setVisible(false);
    this.pit = this.add.graphics().setDepth(3);
    this.materials = new PlayMaterials(this);
    this.hints = this.add.graphics().setDepth(25);
    this.signal = this.add.graphics().setDepth(8);
    this.supplyImage = this.add.image(0, -12, "crate").setDisplaySize(142, 95);
    this.supply = this.add.container(861, 403, [
      this.add.ellipse(0, 14, 116, 50, 0x496b58, 0.2),
      this.supplyImage,
      this.add.circle(30, 17, 20, 0xfaf0cc),
      this.add.text(30, 16, "↻", {fontSize: "30px", color: "#416c60", fontFamily: "Arial"}).setOrigin(0.5),
    ]).setDepth(20);
    this.resetBlocks();
    this.spawnRocks();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.pointerDown(this.worldPointer(p)));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.pointerMove(this.worldPointer(p)));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.pointerUp(this.worldPointer(p)));
    this.input.on("pointerupoutside", () => this.clearControls());
    this.game.canvas.addEventListener("pointercancel", this.blur);
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("blur", this.blur);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.resizeView);
      window.removeEventListener("keydown", this.keyDown);
      window.removeEventListener("blur", this.blur);
      this.game.canvas.removeEventListener("pointercancel", this.blur);
    });
    this.updateVisuals(0);
    this.callbacks.onReady();
    this.publish();
  }

  private drawWorld(): void {
    const g = this.add.graphics();
    g.fillStyle(0xe5ede4).fillRect(0, 0, 960, 540);
    g.fillStyle(0xc7a675).fillRoundedRect(14, 210, 932, 307, 28);
    g.fillStyle(0xe3c99e).fillRoundedRect(14, 210, 932, 290, 28);
    g.fillStyle(0xc6b68e).fillRoundedRect(50, 360, 865, 85, 30);
    g.lineStyle(4, 0xf2ddb0).lineBetween(430, 430, 805, 430);
    this.railway = this.add.graphics();
    this.railway.fillStyle(0xb29366).fillRoundedRect(30, 184, 900, 47, 10);
    for (let x = 45; x < 930; x += 32) this.railway.fillStyle(0x86694a).fillRoundedRect(x, 186, 12, 44, 3);
    this.railway.lineStyle(5, 0x4d5652).lineBetween(25, 196, 937, 196).lineBetween(25, RAIL_Y, 937, RAIL_Y);
  }

  selectActivity(activity: PlayActivity): void {
    if (this.paused || this.activity === activity) return;
    this.clearControls();
    this.parking[this.activity] = this.truckX;
    this.activity = activity;
    this.materials.clearFeedback();
    this.suspension = this.suspensionSpeed = 0;
    if (activity === "rocks") {
      for (const rock of this.rocks) if (rock.state === "falling") rock.image.setAwake();
      for (const block of this.blocks) block.setAwake();
    }
    for (const body of this.trainBodies) this.matter.body.set(body, "isSleeping", activity !== "rocks");
    this.truckX = this.parking[activity];
    this.sprayTime = 0;
    this.washTarget = undefined;
    this.pourQueue = [];
    this.truckTarget = undefined;
    this.truckSpeed = 0;
    this.tiltTarget = this.tilt = 0;
    this.truck.body.setTexture(activity === "rocks" ? "dump" : activity === "build" ? "mixer" : "tanker");
    this.pourTarget = undefined;
    this.updateVisuals(0);
    this.publish();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.clearControls();
    if (paused) this.matter.world.pause();
    else this.matter.world.resume();
  }

  clearControls(): void {
    this.activePointer = undefined;
    this.pointerStart = undefined;
    this.grabbed = undefined;
    this.grabTarget = undefined;
    this.dragBed = false;
  }

  private pointerDown(p: Pick<Phaser.Input.Pointer, "id" | "x" | "y">): void {
    if (this.paused || this.activePointer !== undefined) return;
    this.activePointer = p.id;
    this.pointerStart = {x: p.x, y: p.y};
    if (p.x > 804 && p.y > 330) { this.replenish(); return; }
    if (this.activity === "rocks") {
      const rock = [...this.rocks].reverse().find(r => r.image.visible && Phaser.Math.Distance.Between(p.x, p.y, r.image.x, r.image.y) < 38 && (r.state === "track" || r.state === "falling"));
      if (rock) { this.grabbed = rock; return; }
      if (Math.abs(p.x - (this.truckX - 80)) < 100 && Math.abs(p.y - (TRUCK_Y - 30)) < 90) {
        if (this.truckX > 440) this.truckTarget = 410;
        else this.dragBed = true;
        return;
      }
      if (p.x < 385 && p.y > 290) { this.truckTarget = 410; return; }
      if (p.y < 240) this.pulse();
    } else if (this.activity === "build") {
      if (p.x < 410 && p.y > 290) this.startPour(Phaser.Math.Clamp(Math.floor((p.x - 110) / 95), 0, 2));
      else if (p.y > 270 && p.x < 790) this.startPour(this.bridge.findIndex(value => value < 1));
    } else if (p.y > 225 && p.x < 550) {
      this.washTarget = {x: p.x, y: p.y};
      this.sprayTime = 0.5;
      this.cleanAt(p.x, p.y);
    }
  }

  private pointerMove(p: Pick<Phaser.Input.Pointer, "id" | "x" | "y">): void {
    if (this.paused || p.id !== this.activePointer || !this.pointerStart) return;
    if (this.dragBed) this.tiltTarget = Phaser.Math.Clamp((this.pointerStart.y - p.y) / 110, 0, 1);
    if (this.grabbed && this.grabbed.state === "falling") {
      this.grabTarget = {x: p.x, y: p.y};
    }
    if (this.activity === "wash" && p.y > 200 && p.x < 550) {
      this.washTarget = {x: p.x, y: p.y};
      this.sprayTime = 0.25;
      this.cleanAt(p.x, p.y);
    }
  }

  private pointerUp(p: Pick<Phaser.Input.Pointer, "id" | "x" | "y">): void {
    if (this.paused || p.id !== this.activePointer) return;
    const distance = this.pointerStart ? Phaser.Math.Distance.Between(p.x, p.y, this.pointerStart.x, this.pointerStart.y) : 0;
    if (this.grabbed) {
      if (this.grabbed.state === "track" || distance < 14 || Math.abs(p.x - this.truckX) < 120) this.loadRock(this.grabbed);
    }
    if (this.dragBed && distance < 14) this.tiltTarget = this.tiltTarget > 0.5 ? 0 : 1;
    this.clearControls();
  }

  /** Keyboard and assistive button perform the next visible toy interaction. */
  interact(): void {
    if (this.paused) return;
    if (this.activity === "rocks") {
      const rock = this.rocks.find(r => r.state === "track");
      if (rock) this.loadRock(rock);
      else if (this.rocks.some(r => r.state === "bed" || r.state === "loading")) {
        if (this.truckX > 440) this.truckTarget = 410;
        else this.tiltTarget = this.tiltTarget > 0.5 ? 0 : 1;
      } else this.replenish();
    } else if (this.activity === "build") {
      const index = this.bridge.findIndex(value => value < 1);
      if (index >= 0) this.startPour(index);
      else this.replenish();
    } else {
      const index = this.dirt.findIndex(Boolean);
      if (index >= 0) {
        const point = this.dirtPoint(index);
        this.washTarget = point;
        this.sprayTime = 0.5;
        this.cleanAt(point.x, point.y);
      } else this.replenish();
    }
  }

  private loadRock(rock: Rock): void {
    if (rock.state === "loading" || rock.state === "bed" || this.rocks.filter(r => r.state === "loading" || r.state === "bed").length >= 6) return;
    rock.from = {x: rock.image.x, y: rock.image.y};
    rock.state = "loading";
    rock.progress = 0;
    rock.image.setStatic(true).setCollidesWith(0).setRotation(0);
    this.tiltTarget = 0;
    this.pulse();
  }

  private spawnRocks(): void {
    this.trainBodies.forEach((body, i) => {
      this.matter.body.setPosition(body, {x:390 + (i ? carriageOffset(i - 1).x : 0), y:body.position.y});
      this.matter.body.setVelocity(body, {x:0, y:0});
    });
    for (let i = 0; i < 3; i++) {
      const x = 535 + i * 66, y = 190 + (i % 2) * 4;
      const image = this.matter.add.image(x, y, "material-rock-" + i).setDisplaySize(53, 53);
      image.setBody({type: "circle", radius: 21});
      image.setStatic(true).setCollisionCategory(4).setCollidesWith(0).setBounce(this.callbacks.reducedMotion ? 0.08 : 0.25).setFriction(0.6);
      image.setDepth(20);
      let lastImpact = -1;
      image.setOnCollide(() => {
        const body = image.body as MatterJS.BodyType;
        if (this.paused || this.activity !== "rocks" || this.elapsed - lastImpact < 0.3 || body.speed < 1.5) return;
        lastImpact = this.elapsed;
        this.materials.burst("settle", image.x, image.y + 18);
      });
      this.rocks.push({image, state: "track", from: {x, y}, progress: 0});
    }
  }

  private resetBlocks(): void {
    this.blocks.forEach(block => block.destroy());
    this.blocks = [];
    for (const [x, y] of [[170, 425], [210, 425], [250, 425], [190, 387], [230, 387], [210, 349]]) {
      const image = this.matter.add.image(x, y, "material-block").setDisplaySize(48, 48);
      image.setBody({type: "rectangle", width: 36, height: 36}).setCollisionCategory(4).setCollidesWith([2, 4]).setFriction(0.6).setBounce(0.08).setDepth(10);
      this.blocks.push(image);
    }
  }

  private replenish(): void {
    if (this.activity === "rocks") {
      if (this.rocks.some(r => r.state === "track" || r.state === "loading")) return;
      // Wait until the whole train is beyond the crossing before placing new rocks.
      const x = this.trainBodies[0].position.x;
      this.waitingForRocks = x > 390 && x < 1300;
      if (!this.waitingForRocks) this.spawnRocks();
      const old = this.rocks.filter(r => r.state === "falling" && r !== this.grabbed);
      for (const rock of old.slice(0, Math.max(0, this.rocks.length - 24))) {
        rock.image.destroy();
        this.rocks.splice(this.rocks.indexOf(rock), 1);
      }
      this.resetBlocks();
      this.truckTarget = 670;
      this.tiltTarget = 0;
    } else if (this.activity === "build") {
      this.bridge = [0, 0, 0];
      this.pourQueue = [];
      this.pourTarget = undefined;
      this.cargoX = 70;
    } else {
      this.dirt = [true, true, true, true, true];
      this.flight = 0;
    }
    this.materials.clearFeedback();
    this.pulse();
  }

  private startPour(index: number): void {
    if (index < 0 || this.bridge[index] >= 1 || this.pourTarget === index || this.pourQueue.includes(index)) return;
    if (this.pourTarget === undefined) {
      this.pourTarget = index;
      this.truckTarget = 154 + index * 95 - FLEET.mixer.pourOutlet.x * TRUCK_SCALE;
    } else this.pourQueue.push(index);
    this.pulse();
  }

  private dirtPoint(index: number): {x: number; y: number} {
    return {x: 285 + [-68, -27, 25, 67, 0][index], y: 337 + [-3, 8, -3, 1, 31][index]};
  }

  private cleanAt(x: number, y: number): void {
    let cleaned = false;
    this.dirt.forEach((dirty, index) => {
      const point = this.dirtPoint(index);
      if (dirty && Phaser.Math.Distance.Between(x, y, point.x, point.y) < 34) {
        this.dirt[index] = false;
        this.materials.burst("clean", point.x, point.y);
        cleaned = true;
      }
    });
    if (cleaned) {
      if (!this.dirt.some(Boolean)) this.materials.burst("complete", 285, 310);
      this.pulse();
    }
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    const dt = Math.min(delta, 40) / 1000;
    this.elapsed += dt;
    if (this.grabbed?.state === "falling" && this.grabTarget) {
      const image = this.grabbed.image;
      image.setAwake().setVelocity(
        Phaser.Math.Clamp((this.grabTarget.x - image.x) * 0.12, -9, 9),
        Phaser.Math.Clamp((this.grabTarget.y - image.y) * 0.12, -9, 9),
      );
    }
    if (this.truckTarget !== undefined) {
      const distance = this.truckTarget - this.truckX;
      const desired = Math.sign(distance) * Math.min(185, Math.sqrt(700 * Math.abs(distance)));
      this.truckSpeed += Phaser.Math.Clamp(desired - this.truckSpeed, -350 * dt, 350 * dt);
      this.truckX += this.truckSpeed * dt;
      if (Math.abs(distance) < 2 && Math.abs(this.truckSpeed) < 30) { this.truckX = this.truckTarget; this.truckTarget = undefined; this.truckSpeed = 0; }
    }
    if (this.activity === "rocks") this.stepTrain();
    const suspensionTarget = this.callbacks.reducedMotion ? 0 : Math.sin(this.truckX * 0.12) * Math.abs(this.truckSpeed) / 185 * 1.4;
    if (this.callbacks.reducedMotion) this.suspension = this.suspensionSpeed = 0;
    else {
      this.suspensionSpeed += ((suspensionTarget - this.suspension) * 65 - this.suspensionSpeed * 11) * dt;
      this.suspension += this.suspensionSpeed * dt;
      if (this.truckSpeed === 0 && Math.abs(this.suspension) < 0.005 && Math.abs(this.suspensionSpeed) < 0.005) this.suspension = this.suspensionSpeed = 0;
    }
    this.tilt += Phaser.Math.Clamp(this.tiltTarget - this.tilt, -1.8 * dt, 1.8 * dt);
    let slot = 0;
    for (const rock of this.rocks) {
      if (this.activity !== "rocks" || (rock.state !== "loading" && rock.state !== "bed")) continue;
      const x = this.truckX - 82 + (slot % 3) * 35, y = TRUCK_Y + this.suspension * TRUCK_SCALE - 40 - Math.floor(slot / 3) * 32 - this.tilt * (slot % 3) * 12;
      slot++;
      if (rock.state === "loading") {
        rock.progress = Math.min(1, rock.progress + dt * 2.5);
        const t = rock.progress, smooth = t * t * (3 - 2 * t);
        rock.image.setPosition(Phaser.Math.Linear(rock.from.x, x, smooth), Phaser.Math.Linear(rock.from.y, y, smooth) - Math.sin(t * Math.PI) * 65);
        rock.image.setRotation(this.callbacks.reducedMotion ? 0 : Math.sin(t * Math.PI) * 0.55);
        if (t === 1) {
          rock.state = "bed";
          if (!this.callbacks.reducedMotion) this.suspensionSpeed = Math.min(30, this.suspensionSpeed + 12);
          this.materials.burst("settle", x, y + 14);
        }
      } else rock.image.setPosition(x, y);
    }
    if (this.activity === "rocks" && this.tilt > 0.45 && this.truckX <= 440) {
      this.releaseClock += dt * this.tilt;
      if (this.releaseClock > 0.18) {
        this.releaseClock = 0;
        const rock = this.rocks.find(r => r.state === "bed");
        if (rock) {
          rock.state = "falling";
          rock.image.setPosition(this.truckX - 125, TRUCK_Y - 30).setStatic(false).setAwake().setCollidesWith([2, 4]).setVelocity(-3.3, -0.5);
          this.delivered++;
          if (!this.callbacks.reducedMotion) this.suspensionSpeed -= 6;
          this.pulse();
        }
      }
    }
    if (this.activity === "build" && this.pourTarget !== undefined && this.truckTarget === undefined) {
      this.bridge[this.pourTarget] = Math.min(1, this.bridge[this.pourTarget] + dt * 0.85);
      if (this.bridge[this.pourTarget] === 1) {
        this.materials.burst("complete", 154 + this.pourTarget * 95, this.materials.bridgeContactY() - 8);
        this.pourTarget = this.pourQueue.shift();
        if (this.pourTarget !== undefined) this.truckTarget = 154 + this.pourTarget * 95 - FLEET.mixer.pourOutlet.x * TRUCK_SCALE;
        else if (this.bridge.every(value => value === 1)) this.truckTarget = 670;
        this.pulse();
      }
    }
    if (this.activity === "build" && this.bridge.every(value => value === 1)) {
      this.cargoX = Math.min(430, this.cargoX + dt * 95);
    }
    this.sprayTime = Math.max(0, this.sprayTime - dt);
    if (this.activity === "wash" && !this.dirt.some(Boolean) && this.sprayTime === 0) this.flight = Math.min(4, this.flight + dt);
    this.updateVisuals(dt);
    this.publish();
  }

  private stepTrain(): void {
    const locomotive = this.trainBodies[0];
    if (locomotive.position.x >= 1300) {
      for (const body of this.trainBodies) {
        this.matter.body.setVelocity(body, {x: 0, y: 0});
        this.matter.body.set(body, "isSleeping", true);
      }
      if (this.waitingForRocks) {
        this.waitingForRocks = false;
        this.spawnRocks();
      }
      return;
    }
    const blocked = this.rocks.some(r => r.state === "track");
    const stop = blocked && locomotive.position.x >= 385 && locomotive.position.x < 440;
    for (const body of this.trainBodies) if (!stop) this.matter.body.set(body, "isSleeping", false);
    this.matter.body.setVelocity(locomotive, {x: stop ? 0 : 2.1, y: 0});
    if (stop) this.matter.body.setPosition(locomotive, {x: 390, y: locomotive.position.y});
    this.trainBodies.forEach((body, i) => {
      const model = i ? FLEET.carriage : FLEET.train;
      this.matter.body.setPosition(body, {x: body.position.x, y: RAIL_Y - model.railContact.y});
      this.matter.body.setAngle(body, 0);
    });
  }

  private makeToy(key: keyof typeof ASSETS, model: Pick<typeof FLEET.dump, "spriteWidth" | "spriteHeight" | "wheelRadius" | "wheelAspect" | "wheels" | "farWheels">, scale: number, depth: number): Toy {
    const visual = this.add.container(0, 0).setScale(scale).setDepth(depth);
    const wheels: Phaser.GameObjects.Image[] = [];
    const addWheel = (p: {x: number; y: number}) => {
      const wheel = this.add.image(0, 0, "wheel").setDisplaySize(model.wheelRadius * 2.11, model.wheelRadius * 2.11);
      const markers = this.add.graphics();
      wheel.setData({markers, roll: 0});
      visual.add(this.add.container(p.x, p.y, [wheel, markers]).setScale(1, model.wheelAspect));
      wheels.push(wheel);
    };
    model.farWheels.forEach(addWheel);
    const body = this.add.image(0, 0, key).setDisplaySize(model.spriteWidth, model.spriteHeight);
    visual.add(body);
    model.wheels.forEach(addWheel);
    return {visual, body, wheels, previousX: 0};
  }

  private updateVisuals(dt: number): void {
    const rocks = this.activity === "rocks";
    this.railway.setVisible(rocks);
    this.signal.setVisible(rocks);
    this.train.visual.setVisible(rocks);
    this.carriages.forEach(toy => toy.visual.setVisible(rocks));
    this.airplane.visual.setVisible(this.activity === "wash");
    this.truck.visual.setPosition(this.truckX, TRUCK_Y);
    this.truck.body.setY(this.suspension);
    const frame = this.activity === "rocks" ? Math.round(this.tilt * (FLEET.dump.animationFrames - 1)) : this.activity === "build" && this.pourTarget !== undefined && this.truckTarget === undefined ? Math.floor(this.elapsed * (this.callbacks.reducedMotion ? 4 : 24)) % FLEET.mixer.animationFrames : 0;
    const kind = this.activity === "rocks" ? "dump" : this.activity === "build" ? "mixer" : "tanker";
    this.truck.body.setTexture(frame ? `${kind}-${frame}` : kind)
      .setDisplaySize(FLEET[kind].spriteWidth, FLEET[kind].spriteHeight);
    this.train.visual.setPosition(this.trainBodies[0].position.x, this.trainBodies[0].position.y);
    this.carriages.forEach((toy, i) => toy.visual.setPosition(this.trainBodies[i + 1].position.x, this.trainBodies[i + 1].position.y));
    for (const toy of [this.truck, this.train, ...this.carriages, this.cargo]) {
      const distance = toy.previousX ? toy.visual.x - toy.previousX : 0;
      const radius = toy === this.truck ? FLEET.dump.wheelRadius * TRUCK_SCALE : toy === this.train ? FLEET.train.wheelRadius : FLEET.carriage.wheelRadius;
      for (const wheel of toy.wheels) {
        const angle = wheel.getData("roll") + rollingAngle(distance, radius);
        wheel.setData("roll", angle);
        const markers = wheel.getData("markers") as Phaser.GameObjects.Graphics;
        markers.clear().fillStyle(0xe8c783);
        for (let i = 0; i < 3; i++) {
          const phase = angle + i * Math.PI * 2 / 3;
          markers.fillCircle(Math.cos(phase) * 6, Math.sin(phase) * 6, 1.5);
        }
      }
      toy.previousX = toy.visual.x;
    }
    const wash = this.activity === "wash";
    if (wash && this.flight === 0) this.airplane.visual.setPosition(285, 337).setScale(1.35).setRotation(0);
    else if (wash) {
      const t = Math.min(1, this.flight / 4);
      const travel = t * t * (3 - 2 * t);
      this.airplane.visual.setPosition(285 + travel * 520, 337 - t ** 1.6 * 250).setScale(1.35 - travel * 0.6)
        .setRotation(this.callbacks.reducedMotion ? 0 : -Math.sin(t * Math.PI) * 0.16);
    }
    this.airplaneShadow.setVisible(wash && this.flight < 4).setPosition(this.airplane.visual.x, 399)
      .setScale(1 - this.flight / 5).setAlpha(0.18 * (1 - this.flight / 4));
    if (wash && this.flight > 0 && this.flight < 4) this.propeller.rotation += dt * (this.callbacks.reducedMotion ? 5 : 24);
    for (const rock of this.rocks) {
      rock.image.setVisible(rocks);
      if (this.activity !== "rocks" && rock.state === "falling") rock.image.setToSleep();
    }
    for (const block of this.blocks) { block.setVisible(this.activity === "rocks"); if (this.activity !== "rocks") block.setToSleep(); }
    this.supply.setScale(1);
    this.pit.clear();
    this.materials.hide();
    this.materials.step(dt, this.callbacks.reducedMotion);
    this.supplyImage.setTexture(rocks ? "crate" : this.activity === "build" ? "material-cement-sack" : "material-water-bucket")
      .setDisplaySize(rocks ? 142 : 104, rocks ? 95 : 104);
    this.hints.clear();
    const ring = (x: number, y: number, radius: number) => {
      this.hints.lineStyle(3, 0xfff2b4, 0.95).strokeCircle(x, y, radius);
    };
    if (this.activity === "rocks") {
      this.pit.fillStyle(0xb6915e).fillRoundedRect(88, 346, 252, 105, 30);
      this.pit.lineStyle(4, 0xf7e3ae).strokeRoundedRect(88, 346, 252, 105, 30);
      const track = this.rocks.filter(r => r.state === "track");
      if (track[0]) ring(track[0].image.x, track[0].image.y, 35);
      if (!track.length && this.rocks.some(r => r.state === "bed")) {
        if (this.truckX > 440) ring(310, 340, 31);
        else {
          ring(this.truckX - 67, TRUCK_Y - 56, 27);
          this.hints.lineStyle(6, 0xf9e39e).lineBetween(this.truckX - 67, TRUCK_Y - 43, this.truckX - 67, TRUCK_Y - 71);
        }
      }
    } else if (this.activity === "build") {
      this.materials.showBridge(this.bridge);
      const next = this.bridge.findIndex(value => value < 1);
      if (next >= 0 && this.pourTarget === undefined) ring(154 + next * 95, this.materials.bridgeContactY(), 30);
      if (this.pourTarget !== undefined && this.truckTarget === undefined) {
        this.materials.pour(
          {x:this.truckX + FLEET.mixer.pourOutlet.x * TRUCK_SCALE, y:TRUCK_Y + (FLEET.mixer.pourOutlet.y + this.suspension) * TRUCK_SCALE},
          {x:154 + this.pourTarget * 95, y:this.materials.bridgeContactY()},
          this.elapsed, this.callbacks.reducedMotion,
        );
      }
    } else {
      this.materials.showWash(this.dirt, this.dirt.map((_,i)=>this.dirtPoint(i)), this.flight === 0, {x:this.truckX,y:TRUCK_Y + this.suspension * TRUCK_SCALE}, dt, this.callbacks.reducedMotion);
      const next = this.dirt.findIndex(Boolean);
      if (this.flight === 0 && next >= 0) {
        const point = this.dirtPoint(next);
        ring(point.x,point.y,25);
      }
      if (this.sprayTime > 0 && this.washTarget) {
        this.materials.spray(this.materials.waterOutlet(),this.washTarget,this.elapsed,this.callbacks.reducedMotion);
      }
    }
    this.cargo.visual.setVisible(this.activity === "build" && this.bridge.every(value => value === 1)).setPosition(this.cargoX, this.materials.bridgeContactY() - FLEET.cargo.groundContact.y * 0.6);
    this.signal.clear();
    const blocked = this.rocks.some(r => r.state === "track");
    this.signal.fillStyle(0x716650).fillRoundedRect(469, 116, 8, 86, 3);
    this.signal.fillStyle(0x414d45).fillRoundedRect(457, 117, 31, 45, 10);
    this.signal.fillStyle(blocked ? 0xd88b63 : 0x9bc780).fillCircle(472, 139, 10);
    if (rocks && this.waitingForRocks) ring(861, 394, 43);
  }

  getSnapshot(): FreePlaySnapshot {
    const load = this.rocks.filter(r => r.state === "bed" || r.state === "loading").length;
    const remaining = this.rocks.filter(r => r.state === "track").length;
    const action = this.activity === "rocks" ? remaining ? "Sentuh batu di rel" : load ? this.truckX > 440 ? "Sentuh tempat bongkar" : "Angkat bak truk" : "Sentuh kotak untuk batu lagi" :
      this.activity === "build" ? this.bridge.every(v => v === 1) ? "Jembatan jadi! Truk bisa lewat" : "Sentuh cetakan jembatan" :
      this.dirt.some(Boolean) ? "Sentuh lumpur untuk mencuci" : "Bersih! Pesawat terbang";
    return {activity: this.activity, load, delivered: this.delivered, remaining, bridge: this.bridge.filter(v => v === 1).length, dirty: this.dirt.filter(Boolean).length, moving: this.truckTarget !== undefined, action, status: action};
  }

  private pulse(): void { this.callbacks.onActionAccepted(); }

  private publish(): void {
    const snapshot = this.getSnapshot();
    const next = JSON.stringify(snapshot);
    if (next !== this.lastSnapshot) { this.lastSnapshot = next; this.callbacks.onChange(snapshot); }
  }
}
