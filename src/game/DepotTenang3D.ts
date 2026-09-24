import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import RAPIER from "@dimforge/rapier3d-compat";
import type { DepotTenangGameOptions } from "./depotTenangGameFactory";
import type { FreePlaySnapshot, PlayActivity } from "./depotTenangTypes";
import { collectRollingWheels, rollWheels, type RollingWheel } from "./rollingWheels";

const MODEL_NAMES = [
  "fleet-dump", "fleet-mixer", "fleet-tanker", "fleet-train", "fleet-carriage",
  "fleet-cargo", "fleet-airplane", "fleet-crate", "material-stone-0",
  "material-stone-1", "material-stone-2", "material-wooden-block",
  "material-concrete-form", "material-mud-patch", "material-cement-sack",
  "material-water-bucket", "material-concrete-drop", "material-water-splash",
  "env-station", "env-garage", "env-hangar", "env-tree",
] as const;
type ModelName = typeof MODEL_NAMES[number];
type Rock = {
  visual: THREE.Group;
  target: THREE.Mesh;
  state: "track" | "loading" | "bed" | "falling";
  body?: RAPIER.RigidBody;
  from: THREE.Vector3;
  progress: number;
  bedSlot?: number;
};
type Block = { visual: THREE.Group; body: RAPIER.RigidBody };
type VisualEffect = {
  visual: THREE.Object3D;
  start: THREE.Vector3;
  end?: THREE.Vector3;
  age: number;
  duration: number;
  rise: number;
  baseScale: number;
  control?: THREE.Vector3;
  onComplete?: () => void;
  disposable?: boolean;
};
type PickAction = "rock" | "truck" | "pit" | "form" | "mud" | "supply";

const ROAD_Z = 4.25;
const RAIL_Z = -4.5;
const RAIL_OFFSET = 0.7;
const RAIL_TOP = 0.37;
const TRAIN_STOP_X = -2.6;
const PIT_X = -10;
const UNLOAD_X = -6.1;
const ROCK_X = [0.7, 2.4, 4.1];
const FORM_X = [-5, -2.5, 0];
const MIXER_FORM_OFFSET = 3.2;
const MUD_X = [-1.85, -0.92, 0, 0.92, 1.85];
const DRUM_AXIS = new THREE.Vector3(0, 0, 1);
const TRUCK_MAX_SPEED = 5.2;
const TRUCK_ACCELERATION = 7;
const TRUCK_BRAKING = 8;
const TRUCK_APPROACH_BRAKING = 5;
const COLORS = {
  wood: 0xd2a86d, rim: 0x986e43, felt: 0x86a978, road: 0x424949,
  roadLine: 0xe7d5a7, rail: 0x52595b, sleeper: 0x79543d, gold: 0xffdb79,
};

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function box(parent: THREE.Object3D, color: number, size: [number, number, number], position: [number, number, number], radius = 0): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.83, metalness: radius ? 0.08 : 0 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function disc(parent: THREE.Object3D, color: number, radius: number, position: [number, number, number], opacity = 1): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.035, 40),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, transparent: opacity < 1, opacity }),
  );
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function pickTarget(parent: THREE.Object3D, action: PickAction, index: number, size: [number, number, number], position: [number, number, number]): THREE.Mesh {
  const target = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  target.position.set(...position);
  target.userData = { action, index };
  parent.add(target);
  return target;
}

/** One shared 3D diorama. Only loose materials use simulated rigid bodies. */
export class DepotTenang3D {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
  private readonly loader = new GLTFLoader();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly templates = new Map<ModelName, THREE.Group>();
  private readonly physics = new RAPIER.World({ x: 0, y: -12, z: 0 });
  private readonly resizeObserver: ResizeObserver;
  private readonly pickables: THREE.Object3D[] = [];
  private readonly rocks: Rock[] = [];
  private readonly blocks: Block[] = [];
  private readonly forms: THREE.Group[] = [];
  private readonly concrete: THREE.Mesh[] = [];
  private readonly mud: THREE.Group[] = [];
  private readonly trainCars: THREE.Group[] = [];
  private readonly truckModels = {} as Record<PlayActivity, THREE.Group>;
  private readonly truckWheels = {} as Record<PlayActivity, RollingWheel[]>;
  private trainWheels: RollingWheel[] = [];
  private readonly trainCarWheels: RollingWheel[][] = [];
  private cargoWheels: RollingWheel[] = [];
  private readonly effects: VisualEffect[] = [];
  private readonly clock = new THREE.Clock();
  private readonly focus = new THREE.Vector3();
  private activity: PlayActivity = "rocks";
  private paused = false;
  private disposed = false;
  private elapsed = 0;
  private accumulator = 0;
  private frame = 0;
  private truck = new THREE.Group();
  private truckX = 6;
  private truckTarget?: number;
  private truckSpeed = 0;
  private tilt = 0;
  private tiltTarget = 0;
  private dumpBed?: THREE.Object3D;
  private mixerDrum?: THREE.Object3D;
  private pourGuide?: THREE.Mesh;
  private pourGuideTarget?: number;
  private airplane = new THREE.Group();
  private propeller?: THREE.Object3D;
  private train = new THREE.Group();
  private trainX = TRAIN_STOP_X;
  private trainSpeed = 0;
  private cargo = new THREE.Group();
  private cargoX = -12;
  private supply = new THREE.Group();
  private readonly restingPlaces = {} as Record<PlayActivity, THREE.Group>;
  private pit = new THREE.Group();
  private rail = new THREE.Group();
  private hint = new THREE.Group();
  private delivered = 0;
  private bridge = [0, 0, 0];
  private dirty = [true, true, true, true, true];
  private pourTarget?: number;
  private pourQueue: number[] = [];
  private pourClock = 0;
  private sprayTime = 0;
  private flight = 0;
  private waitingForRocks = false;
  private releaseClock = 0;
  private activePointer?: number;
  private pointerStart?: { x: number; y: number };
  private draggingBed = false;
  private grabbed?: Rock;
  private grabTarget?: THREE.Vector3;
  private lastSnapshot = "";
  private portrait = false;

  constructor(private readonly options: DepotTenangGameOptions) {
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.scene.background = new THREE.Color(0xe7eee9);
    this.scene.fog = new THREE.Fog(0xe7eee9, 40, 80);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.55;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-label", "Diorama Depot Tenang 3D");
    this.options.parent.append(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.parent);
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("blur", this.clearControls);
    this.canvas.addEventListener("pointerdown", this.pointerDown);
    this.canvas.addEventListener("pointermove", this.pointerMove);
    this.canvas.addEventListener("pointerup", this.pointerUp);
    this.canvas.addEventListener("pointercancel", this.clearControls);
    this.resize();
  }

  async load(): Promise<void> {
    await Promise.all(MODEL_NAMES.map(async name => {
      const path = `${import.meta.env.BASE_URL}assets/depot-tenang-3d/${name}.glb`;
      const gltf = await this.loader.loadAsync(path);
      this.templates.set(name, gltf.scene);
    }));
    if (this.disposed) return;
    this.buildWorld();
    this.spawnRocks();
    this.resetBlocks();
    this.selectActivity("rocks", true);
    this.options.onReady();
    this.publish();
    this.frame = requestAnimationFrame(this.tick);
  }

  private model(name: ModelName, length: number): THREE.Group {
    const source = this.templates.get(name);
    if (!source) throw new Error(`Missing 3D model: ${name}`);
    const visual = source.clone(true);
    visual.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    visual.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(visual);
    const size = bounds.getSize(new THREE.Vector3());
    const wrapper = new THREE.Group();
    const turn = new THREE.Group();
    const center = bounds.getCenter(new THREE.Vector3());
    visual.position.set(-center.x, -bounds.min.y, -center.z);
    turn.add(visual);
    // The airplane's wings are wide on Z, but its nose already points along +X.
    if (name !== "fleet-airplane" && size.z > size.x * 1.15) turn.rotation.y = Math.PI / 2;
    wrapper.add(turn);
    wrapper.scale.setScalar(length / Math.max(size.x, size.z));
    return wrapper;
  }

  private buildWorld(): void {
    const sky = new THREE.HemisphereLight(0xffffff, 0xb5aa91, 2.3);
    this.scene.add(sky);
    const sun = new THREE.DirectionalLight(0xffefcd, 3.2);
    sun.position.set(-8, 22, 13);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
    box(this.scene, COLORS.rim, [30.6, 0.75, 16.6], [0, -0.68, 0]);
    box(this.scene, COLORS.wood, [30, 0.3, 16], [0, -0.16, 0]);
    box(this.scene, COLORS.felt, [28.8, 0.06, 14.8], [0, 0.035, 0]);
    box(this.scene, COLORS.road, [28, 0.055, 3.1], [0, 0.1, ROAD_Z]);
    for (let x = -13; x <= 13; x += 2) box(this.scene, COLORS.roadLine, [0.8, 0.01, 0.055], [x, 0.135, ROAD_Z]);
    box(this.scene, 0xa88a64, [28, 0.05, 2.35], [0, 0.1, RAIL_Z]);
    for (let x = -13.5; x <= 13.5; x += 0.74) box(this.rail, COLORS.sleeper, [0.22, 0.12, 2.0], [x, 0.2, RAIL_Z]);
    for (const z of [RAIL_Z - RAIL_OFFSET, RAIL_Z + RAIL_OFFSET]) box(this.rail, COLORS.rail, [28, 0.12, 0.12], [0, 0.31, z]);
    this.scene.add(this.rail);
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(15, 0.1, 8).setTranslation(0, -0.1, 0));
    for (const x of [-14.5, 14.5]) this.physics.createCollider(RAPIER.ColliderDesc.cuboid(0.18, 1, 8).setTranslation(x, 0.8, 0));
    for (const [x, z, scale] of [[-12.4, -6.55, 2.1], [12.4, -6.45, 1.8], [-12.5, 6.45, 1.65], [12.4, 6.4, 1.9]]) {
      const tree = this.model("env-tree", scale);
      tree.position.set(x, 0.09, z);
      this.scene.add(tree);
    }
    this.restingPlaces.rocks = this.model("env-station", 4.5);
    this.restingPlaces.rocks.position.set(-9.8, 0.1, -1.55);
    this.restingPlaces.build = this.model("env-garage", 4.4);
    this.restingPlaces.build.position.set(8.8, 0.1, -1.4);
    this.restingPlaces.wash = this.model("env-hangar", 5);
    this.restingPlaces.wash.position.set(-10.25, 0.1, -1.6);
    this.scene.add(...Object.values(this.restingPlaces));

    this.truck.position.set(this.truckX, 0.15, ROAD_Z);
    this.scene.add(this.truck);
    const truckNames: Record<PlayActivity, ModelName> = { rocks: "fleet-dump", build: "fleet-mixer", wash: "fleet-tanker" };
    for (const activity of ["rocks", "build", "wash"] as const) {
      const vehicle = this.model(truckNames[activity], 5);
      this.truckModels[activity] = vehicle;
      this.truck.add(vehicle);
      this.truckWheels[activity] = collectRollingWheels(vehicle);
      vehicle.visible = activity === "rocks";
    }
    pickTarget(this.truck, "truck", 0, [5.2, 2.8, 2.8], [0, 1.25, 0]);
    this.pickables.push(this.truck);
    this.setupDumpBed();
    this.mixerDrum = this.truckModels.build.getObjectByName("Mixer_Drum_Pivot") ?? undefined;
    this.pourGuide = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x66736d, roughness: 0.65, metalness: 0.14 }),
    );
    this.pourGuide.visible = false;
    this.pourGuide.castShadow = true;
    this.scene.add(this.pourGuide);

    this.train = this.model("fleet-train", 4.7);
    this.train.position.set(this.trainX, RAIL_TOP, RAIL_Z);
    this.scene.add(this.train);
    this.trainWheels = collectRollingWheels(this.train);
    for (let index = 0; index < 2; index++) {
      const carriage = this.model("fleet-carriage", 3.9);
      carriage.position.set(this.trainX - 4.5 - index * 4.1, RAIL_TOP, RAIL_Z);
      this.trainCars.push(carriage);
      this.scene.add(carriage);
      this.trainCarWheels.push(collectRollingWheels(carriage));
    }

    this.pit.position.set(PIT_X, 0, 2.25);
    disc(this.pit, 0xb59a70, 1.85, [0, 0.13, 0]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 8, 48), new THREE.MeshStandardMaterial({ color: 0xf2dca7 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.17;
    this.pit.add(ring);
    const pitWallRadius = 1.7;
    const pitWallSegments = 20;
    const pitWallLength = 2 * Math.PI * pitWallRadius / pitWallSegments + 0.04;
    for (let index = 0; index < pitWallSegments; index++) {
      const angle = 2 * Math.PI * index / pitWallSegments;
      const rotation = -angle - Math.PI / 2;
      const x = pitWallRadius * Math.cos(angle);
      const z = pitWallRadius * Math.sin(angle);
      const wall = box(this.pit, 0xb18b60, [pitWallLength, 0.7, 0.16], [x, 0.47, z]);
      wall.rotation.y = rotation;
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(pitWallLength / 2, 0.35, 0.08)
        .setTranslation(PIT_X + x, 0.47, 2.25 + z)
        .setRotation({ x: 0, y: Math.sin(rotation / 2), z: 0, w: Math.cos(rotation / 2) }));
    }
    pickTarget(this.pit, "pit", 0, [4.1, 0.5, 3.2], [0, 0.3, 0]);
    this.scene.add(this.pit);
    this.pickables.push(this.pit);

    FORM_X.forEach((x, index) => {
      const form = this.model("material-concrete-form", 2.9);
      form.position.set(x, 0.16, 0.6);
      form.add(pickTarget(form, "form", index, [3.0, 0.75, 2.0], [0, 0.35, 0]));
      const fill = box(form, 0xa4aca7, [2.45, 0.16, 0.97], [0, 0.22, 0]);
      fill.visible = false;
      this.forms.push(form);
      this.concrete.push(fill);
      this.scene.add(form);
      this.pickables.push(form);
    });
    this.cargo = this.model("fleet-cargo", 3.6);
    this.cargo.position.set(this.cargoX, 0.15, 0.6);
    this.scene.add(this.cargo);
    this.cargoWheels = collectRollingWheels(this.cargo);

    this.airplane = this.model("fleet-airplane", 5.1);
    this.airplane.position.set(-5, 0.16, -0.9);
    this.propeller = this.airplane.getObjectByName("Airplane_Propeller_Pivot") ?? undefined;
    this.scene.add(this.airplane);
    MUD_X.forEach((x, index) => {
      const patch = this.model("material-mud-patch", 0.67);
      patch.position.set(x, 1.4 + (index % 2) * 0.08, index % 2 ? 0.3 : -0.35);
      patch.add(pickTarget(patch, "mud", index, [0.72, 0.65, 0.72], [0, 0.2, 0]));
      this.airplane.add(patch);
      this.mud.push(patch);
      this.pickables.push(patch);
    });

    this.supply.position.set(-10.1, 0.15, 1.15);
    disc(this.supply, COLORS.gold, 1.18, [0, 0.06, 0], 0.55);
    this.supply.add(this.model("fleet-crate", 1.4));
    this.supply.add(this.model("material-cement-sack", 1.2));
    this.supply.add(this.model("material-water-bucket", 1.2));
    pickTarget(this.supply, "supply", 0, [2.8, 2.1, 2.8], [0, 0.8, 0]);
    this.scene.add(this.supply);
    this.pickables.push(this.supply);

    const indicator = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.045, 8, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.86 }),
    );
    indicator.rotation.x = Math.PI / 2;
    this.hint.add(indicator);
    this.scene.add(this.hint);
    this.resize();
  }

  private setupDumpBed(): void {
    const vehicle = this.truckModels.rocks;
    vehicle.traverse(node => {
      if (/^Dump_Rock/.test(node.name)) node.visible = false;
    });
    this.dumpBed = vehicle.getObjectByName("Dump_Bed_Pivot") ?? undefined;
    if (!this.dumpBed) throw new Error("Missing authored dump-bed hinge");
  }

  private spawnRocks(): void {
    for (let index = 0; index < 3; index++) {
      const visual = this.model(`material-stone-${index}` as ModelName, 0.95);
      visual.position.set(ROCK_X[index], 0.37, RAIL_Z);
      const target = pickTarget(visual, "rock", this.rocks.length, [1.3, 1.3, 1.3], [0, 0.4, 0]);
      this.scene.add(visual);
      this.rocks.push({ visual, target, state: "track", from: visual.position.clone(), progress: 0 });
      this.pickables.push(visual);
    }
    this.trainX = TRAIN_STOP_X;
    this.trainSpeed = 0;
  }

  private resetBlocks(): void {
    for (const block of this.blocks) {
      this.physics.removeRigidBody(block.body);
      this.scene.remove(block.visual);
    }
    this.blocks.length = 0;
    const positions: Array<[number, number, number]> = [
      [-10.8, 0.48, 2.18], [-9.9, 0.48, 2.18], [-9, 0.48, 2.18],
      [-10.35, 1.34, 2.18], [-9.45, 1.34, 2.18], [-9.9, 2.2, 2.18],
    ];
    for (const [x, y, z] of positions) {
      const visual = this.model("material-wooden-block", 0.86);
      const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCanSleep(true));
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(0.41, 0.41, 0.34).setFriction(0.75).setRestitution(0), body);
      this.blocks.push({ visual, body });
      this.scene.add(visual);
    }
  }

  selectActivity(activity: PlayActivity, initial = false): void {
    if (this.paused || (this.activity === activity && !initial)) return;
    this.clearControls();
    this.activity = activity;
    this.truckTarget = undefined;
    this.truckSpeed = 0;
    this.tiltTarget = this.tilt = 0;
    if (this.dumpBed) this.dumpBed.rotation.x = 0;
    this.pourTarget = undefined;
    this.pourQueue = [];
    if (this.pourGuide) this.pourGuide.visible = false;
    this.pourGuideTarget = undefined;
    this.sprayTime = 0;
    this.truckX = activity === "rocks" ? 4 : activity === "build" ? 2 : 0;
    this.truck.position.x = this.truckX;
    this.supply.position.x = activity === "rocks" ? -5.9 : activity === "build" ? 4.4 : 1;
    this.supply.position.z = activity === "rocks" ? -0.8 : activity === "build" ? -0.75 : 0;
    for (const name of ["rocks", "build", "wash"] as const) this.truckModels[name].visible = name === activity;
    this.rail.visible = activity === "rocks";
    for (const name of ["rocks", "build", "wash"] as const) this.restingPlaces[name].visible = name === activity;
    this.pit.visible = activity === "rocks";
    this.train.visible = activity === "rocks";
    this.trainCars.forEach(car => { car.visible = activity === "rocks"; });
    this.rocks.forEach(rock => { rock.visual.visible = activity === "rocks"; });
    this.blocks.forEach(block => { block.visual.visible = activity === "rocks"; });
    this.forms.forEach(form => { form.visible = activity === "build"; });
    this.cargo.visible = activity === "build" && this.bridge.every(value => value === 1);
    this.airplane.visible = activity === "wash";
    this.mud.forEach((patch, index) => { patch.visible = this.dirty[index]; });
    this.supply.children.slice(1, 4).forEach((child, index) => { child.visible = index === (["rocks", "build", "wash"] as const).indexOf(activity); });
    for (const effect of this.effects) {
      this.scene.remove(effect.visual);
      if (effect.disposable && effect.visual instanceof THREE.Mesh) {
        effect.visual.geometry.dispose();
        (effect.visual.material as THREE.Material).dispose();
      }
    }
    this.effects.length = 0;
    this.updateHint();
    this.updateCamera(1);
    this.publish();
  }

  interact(): void {
    if (this.paused || this.disposed) return;
    if (this.activity === "rocks") {
      const rock = this.rocks.find(item => item.state === "track");
      if (rock) this.loadRock(rock);
      else if (this.rocks.some(item => item.state === "bed" || item.state === "loading")) {
        if (this.truckX > UNLOAD_X + 0.3) this.truckTarget = UNLOAD_X;
        else this.tiltTarget = this.tiltTarget > 0.5 ? 0 : 1;
      } else this.replenish();
    } else if (this.activity === "build") {
      const index = this.bridge.findIndex((value, candidate) => value < 1 && candidate !== this.pourTarget && !this.pourQueue.includes(candidate));
      if (index >= 0) this.startPour(index);
      else this.replenish();
    } else {
      const index = this.dirty.findIndex(Boolean);
      if (index >= 0) this.clean(index);
      else this.replenish();
    }
    this.publish();
  }

  private loadRock(rock: Rock): void {
    if (rock.state !== "track" && rock.state !== "falling") return;
    if (this.rocks.filter(item => item.state === "loading" || item.state === "bed").length >= 6) return;
    if (rock.body) { this.physics.removeRigidBody(rock.body); rock.body = undefined; }
    const occupied = new Set(this.rocks.filter(item => item.state === "loading" || item.state === "bed").map(item => item.bedSlot));
    let bedSlot = 0;
    while (occupied.has(bedSlot)) bedSlot++;
    rock.bedSlot = bedSlot;
    rock.from.copy(rock.visual.position);
    rock.progress = 0;
    rock.state = "loading";
    this.tiltTarget = 0;
    this.options.onActionAccepted();
    this.publish();
  }

  private startPour(index: number): void {
    if (index < 0 || this.bridge[index] >= 1 || this.pourTarget === index || this.pourQueue.includes(index)) return;
    if (this.pourTarget === undefined) {
      this.pourTarget = index;
      this.truckTarget = FORM_X[index] + MIXER_FORM_OFFSET;
    } else this.pourQueue.push(index);
    this.options.onActionAccepted();
    this.publish();
  }

  private clean(index: number): void {
    if (!this.dirty[index]) return;
    const valve = this.truckModels.wash.getObjectByName("Tanker_Rear_Valve_Box");
    if (!valve) throw new Error("Missing tanker valve");
    this.dirty[index] = false;
    this.sprayTime = 0.65;
    const start = valve.getWorldPosition(new THREE.Vector3());
    const point = this.mud[index].getWorldPosition(new THREE.Vector3());
    const control = start.clone().lerp(point, 0.5);
    control.y = Math.max(start.y, point.y) + 1.05;
    for (let drop = 0; drop < 7; drop++) {
      const visual = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x4aaacb, roughness: 0.3, metalness: 0.05 }),
      );
      visual.visible = false;
      visual.position.copy(start);
      this.scene.add(visual);
      this.effects.push({
        visual, start: start.clone(), end: point.clone(), control: control.clone(),
        age: -drop * 0.06, duration: 0.45, rise: 0, baseScale: 1, disposable: true,
        onComplete: drop === 6 ? () => {
          this.mud[index].visible = false;
          this.effect("material-water-splash", point, 0.65, 0.55);
        } : undefined,
      });
    }
    this.options.onActionAccepted();
    this.publish();
  }

  private replenish(): void {
    if (this.activity === "rocks") {
      if (this.rocks.some(rock => rock.state === "track" || rock.state === "loading")) return;
      if (this.trainX < 17 && this.trainX > TRAIN_STOP_X) this.waitingForRocks = true;
      else this.addFreshRocks();
      this.resetBlocks();
      this.truckTarget = 4;
      this.tiltTarget = 0;
    } else if (this.activity === "build") {
      this.bridge = [0, 0, 0];
      this.forms.forEach((_, index) => { this.concrete[index].visible = false; });
      if (this.pourGuide) this.pourGuide.visible = false;
      this.pourGuideTarget = undefined;
      this.cargoX = -12;
      this.cargo.position.x = this.cargoX;
      this.cargo.visible = false;
      this.truckTarget = 2;
    } else {
      this.dirty = [true, true, true, true, true];
      for (const effect of this.effects) {
        this.scene.remove(effect.visual);
        if (effect.disposable && effect.visual instanceof THREE.Mesh) {
          effect.visual.geometry.dispose();
          (effect.visual.material as THREE.Material).dispose();
        }
      }
      this.effects.length = 0;
      this.mud.forEach(patch => { patch.visible = true; });
      this.flight = 0;
      this.airplane.position.set(-5, 0.16, -0.9);
      this.airplane.rotation.set(0, 0, 0);
    }
    this.options.onActionAccepted();
    this.publish();
  }

  private addFreshRocks(): void {
    const falling = this.rocks.filter(rock => rock.state === "falling");
    for (const rock of falling.slice(0, Math.max(0, falling.length - 21))) {
      if (rock.body) this.physics.removeRigidBody(rock.body);
      this.scene.remove(rock.visual);
      this.pickables.splice(this.pickables.indexOf(rock.visual), 1);
      this.rocks.splice(this.rocks.indexOf(rock), 1);
    }
    this.rocks.forEach((rock, index) => { rock.target.userData.index = index; });
    this.spawnRocks();
    this.trainX = -15;
    this.train.position.x = this.trainX;
    this.trainCars.forEach((car, index) => { car.position.x = this.trainX - 4.5 - index * 4.1; });
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.clearControls();
    this.clock.getDelta();
  }

  clearControls = (): void => {
    this.activePointer = undefined;
    this.pointerStart = undefined;
    this.draggingBed = false;
    this.grabbed = undefined;
    this.grabTarget = undefined;
  };

  private keyDown = (event: KeyboardEvent): void => {
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target instanceof HTMLButtonElement) return;
    if ([" ", "Enter", "ArrowRight", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      this.interact();
    }
  };

  private pick(event: PointerEvent): { action: PickAction; index: number } | undefined {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, true);
    for (const hit of hits) {
      let visible: THREE.Object3D | null = hit.object;
      while (visible && visible.visible) visible = visible.parent;
      if (visible) continue;
      let node: THREE.Object3D | null = hit.object;
      while (node && !node.userData.action) node = node.parent;
      if (node?.userData.action) {
        const picked = node.userData as { action: PickAction; index: number };
        if (picked.action === "truck" && this.activity !== "rocks") continue;
        return picked;
      }
    }
    return undefined;
  }

  private pointerDown = (event: PointerEvent): void => {
    if (this.paused || this.activePointer !== undefined) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointer = event.pointerId;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    const hit = this.pick(event);
    if (!hit) return;
    if (hit.action === "supply") this.replenish();
    else if (this.activity === "rocks" && hit.action === "rock") {
      const rock = this.rocks[hit.index];
      if (rock.state === "falling") this.grabbed = rock;
      else this.loadRock(rock);
    }
    else if (this.activity === "rocks" && hit.action === "pit") this.truckTarget = UNLOAD_X;
    else if (this.activity === "rocks" && hit.action === "truck") {
      if (this.truckX > UNLOAD_X + 0.3) this.truckTarget = UNLOAD_X;
      else this.draggingBed = true;
    } else if (this.activity === "build" && hit.action === "form") this.startPour(hit.index);
    else if (this.activity === "wash" && hit.action === "mud") this.clean(hit.index);
  };

  private pointerMove = (event: PointerEvent): void => {
    if (this.paused || event.pointerId !== this.activePointer || !this.pointerStart) return;
    if (this.draggingBed) this.tiltTarget = clamp((this.pointerStart.y - event.clientY) / 115, 0, 1);
    if (this.grabbed?.body) {
      const bounds = this.canvas.getBoundingClientRect();
      this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      this.grabTarget = this.raycaster.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.4), new THREE.Vector3(),
      ) ?? undefined;
    }
    if (this.activity === "wash") {
      const hit = this.pick(event);
      if (hit?.action === "mud") this.clean(hit.index);
    }
  };

  private pointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return;
    if (this.draggingBed && this.pointerStart && Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) < 14) {
      this.tiltTarget = this.tiltTarget > 0.5 ? 0 : 1;
    }
    if (this.grabbed && this.pointerStart && Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) < 14) {
      this.loadRock(this.grabbed);
    }
    this.clearControls();
  };

  private resize = (): void => {
    if (this.disposed) return;
    const bounds = this.options.parent.getBoundingClientRect();
    this.portrait = bounds.width < 601 && bounds.height > bounds.width;
    const width = Math.max(1, this.portrait ? bounds.width : Math.min(bounds.width, bounds.height * 16 / 9));
    const height = Math.max(1, this.portrait ? bounds.height : width * 9 / 16);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, 3840 / width);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.updateCamera(1);
  };

  private updateCamera(dt: number): void {
    let target = 0;
    if (this.portrait) {
      if (this.activity === "rocks") target = this.rocks.some(rock => rock.state === "track") ? 2.3 : this.truckX < 3 ? this.truckX - 0.4 : 2.3;
      else if (this.activity === "build") target = -0.9;
      else target = -2.6;
    }
    this.focus.x = THREE.MathUtils.lerp(this.focus.x, target, this.options.reducedMotion ? 1 : Math.min(1, dt * 2.8));
    const offset = this.portrait ? [4.3, 18, 25] : [6.5, 17, 25];
    this.camera.position.set(this.focus.x + offset[0], offset[1], offset[2]);
    this.camera.lookAt(this.focus.x, 0, 0);
  }

  private tick = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.2);
    if (!this.paused) {
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    }
  };

  private update(dt: number): void {
    this.elapsed += dt;
    if (this.grabbed?.body && this.grabTarget) {
      const position = this.grabbed.body.translation();
      this.grabbed.body.setLinvel({
        x: clamp((this.grabTarget.x - position.x) * 5, -6, 6),
        y: clamp((this.grabTarget.y - position.y) * 5, -4, 5),
        z: clamp((this.grabTarget.z - position.z) * 5, -6, 6),
      }, true);
    }
    this.accumulator += dt;
    while (this.accumulator >= 1 / 60) {
      this.physics.timestep = 1 / 60;
      this.physics.step();
      this.accumulator -= 1 / 60;
    }
    for (const block of this.blocks) {
      const position = block.body.translation();
      const rotation = block.body.rotation();
      block.visual.position.set(position.x, position.y - 0.43, position.z);
      block.visual.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    for (const rock of this.rocks) {
      if (!rock.body) continue;
      const position = rock.body.translation();
      const rotation = rock.body.rotation();
      rock.visual.position.set(position.x, position.y - 0.36, position.z);
      rock.visual.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      if (position.y < -1 || Math.abs(position.x) > 14) {
        rock.body.setTranslation({ x: PIT_X, y: 2.5, z: 2.2 }, true);
        rock.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
    this.moveTruck(dt);
    this.stepTrain(dt);
    this.stepRocks(dt);
    this.stepPour(dt);
    if (this.activity === "build" && this.bridge.every(value => value === 1)) {
      const previousX = this.cargoX;
      this.cargoX = Math.min(3.5, this.cargoX + dt * 1.8);
      this.cargo.position.x = this.cargoX;
      rollWheels(this.cargoWheels, this.cargoX - previousX);
      this.cargo.visible = true;
    }
    if (this.activity === "wash") {
      this.sprayTime = Math.max(0, this.sprayTime - dt);
      if (!this.dirty.some(Boolean) && !this.mud.some(patch => patch.visible) && this.sprayTime === 0) this.flight = Math.min(4, this.flight + dt);
      const t = this.flight / 4;
      const travel = t * t * (3 - 2 * t);
      this.airplane.position.set(-5 + travel * 18, 0.16 + travel * 10, -0.9 - travel * 3);
      this.airplane.rotation.z = this.options.reducedMotion ? 0 : Math.sin(Math.PI * t) * 0.12;
      if (this.propeller && this.flight > 0) this.propeller.rotation.x += dt * (this.options.reducedMotion ? 5 : 22);
    }
    this.stepEffects(dt);
    this.updateCamera(dt);
    this.updateHint();
    this.publish();
  }

  private moveTruck(dt: number): void {
    const previousX = this.truckX;
    if (this.truckTarget !== undefined) {
      const distance = this.truckTarget - this.truckX;
      const desired = Math.sign(distance) * Math.min(TRUCK_MAX_SPEED, Math.sqrt(2 * TRUCK_APPROACH_BRAKING * Math.abs(distance)));
      const braking = Math.abs(desired) < Math.abs(this.truckSpeed) || (this.truckSpeed !== 0 && Math.sign(desired) !== Math.sign(this.truckSpeed));
      const change = (braking ? TRUCK_BRAKING : TRUCK_ACCELERATION) * dt;
      const nextSpeed = this.truckSpeed + clamp(desired - this.truckSpeed, -change, change);
      const nextX = this.truckX + (this.truckSpeed + nextSpeed) * 0.5 * dt;
      const remaining = this.truckTarget - nextX;
      if (distance * remaining <= 0 || (Math.abs(remaining) < 0.01 && Math.abs(nextSpeed) < 0.2)) {
        this.truckX = this.truckTarget;
        this.truckTarget = undefined;
        this.truckSpeed = 0;
      } else {
        this.truckX = nextX;
        this.truckSpeed = nextSpeed;
      }
    }
    this.truck.position.x = this.truckX;
    this.truck.position.y = 0.15;
    rollWheels(this.truckWheels[this.activity], this.truckX - previousX);
    this.tilt += clamp(this.tiltTarget - this.tilt, -dt * 1.8, dt * 1.8);
    if (this.dumpBed) this.dumpBed.rotation.x = -this.tilt * 38 * Math.PI / 180;
    if (this.mixerDrum && this.activity === "build" && !this.options.reducedMotion) {
      this.mixerDrum.rotateOnAxis(DRUM_AXIS, dt * 0.7);
    }
  }

  private stepTrain(dt: number): void {
    if (this.activity !== "rocks") return;
    if (this.trainX >= 17) {
      if (this.waitingForRocks) { this.waitingForRocks = false; this.addFreshRocks(); }
      return;
    }
    const previousX = this.trainX;
    const blocked = this.rocks.some(rock => rock.state === "track" || rock.state === "loading");
    if (blocked && this.trainX >= TRAIN_STOP_X) {
      this.trainX = TRAIN_STOP_X;
      this.trainSpeed = 0;
    } else {
      this.trainSpeed += clamp(2.25 - this.trainSpeed, -4 * dt, 4 * dt);
      const nextX = this.trainX + this.trainSpeed * dt;
      if (blocked && nextX >= TRAIN_STOP_X) {
        this.trainX = TRAIN_STOP_X;
        this.trainSpeed = 0;
      } else this.trainX = nextX;
    }
    this.train.position.x = this.trainX;
    this.trainCars.forEach((car, index) => { car.position.x = this.trainX - 4.5 - index * 4.1; });
    const distance = this.trainX - previousX;
    rollWheels(this.trainWheels, distance);
    for (const wheels of this.trainCarWheels) rollWheels(wheels, distance);
  }

  private stepRocks(dt: number): void {
    for (const rock of this.rocks) {
      if (rock.state !== "loading" && rock.state !== "bed") continue;
      const slot = rock.bedSlot ?? 0;
      const offset = (slot % 3) * 0.75;
      const slide = rock.state === "bed" ? this.tilt : 0;
      const destination = new THREE.Vector3(
        this.truckX - 0.9 + offset - slide * (1.6 + offset * 0.45),
        1.45 + Math.floor(slot / 3) * 0.36 + slide * 0.28,
        ROAD_Z + (Math.floor(slot / 3) ? 0.5 : -0.5) - slide * 0.7,
      );
      if (rock.state === "loading") {
        rock.progress = Math.min(1, rock.progress + dt * 2.4);
        const t = rock.progress;
        const smooth = t * t * (3 - 2 * t);
        rock.visual.position.copy(rock.from).lerp(destination, smooth);
        rock.visual.position.y += Math.sin(t * Math.PI) * (this.options.reducedMotion ? 0.25 : 1.4);
        if (t === 1) {
          rock.state = "bed";
          this.effect("material-stone-0", destination, 0.28, 0.3);
        }
      } else rock.visual.position.copy(destination);
    }
    if (this.activity !== "rocks" || this.tilt < 0.82 || this.truckX > UNLOAD_X + 0.3) return;
    this.releaseClock += dt * this.tilt;
    if (this.releaseClock < 0.18) return;
    this.releaseClock = 0;
    const rock = this.rocks.find(item => item.state === "bed");
    if (!rock) return;
    rock.state = "falling";
    const start = rock.visual.position;
    const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(start.x, start.y + 0.36, start.z)
      .setLinvel(
        clamp((PIT_X + 0.1 - start.x) / 0.55, -5, -1.5),
        0.4,
        clamp((2.18 - start.z) / 0.55, -2.5, 0),
      )
      .setCcdEnabled(true));
    this.physics.createCollider(RAPIER.ColliderDesc.ball(0.43).setDensity(3).setFriction(0.75).setRestitution(this.options.reducedMotion ? 0 : 0.02), body);
    rock.body = body;
    this.delivered++;
    if (!this.rocks.some(item => item.state === "bed" || item.state === "loading")) this.tiltTarget = 0;
    this.options.onActionAccepted();
  }

  private stepPour(dt: number): void {
    if (this.activity !== "build" || this.pourTarget === undefined || this.truckTarget !== undefined) return;
    const index = this.pourTarget;
    const chute = this.truckModels.build.getObjectByName("Mixer_Chute");
    if (!chute || !this.pourGuide) throw new Error("Missing mixer chute");
    const start = chute.getWorldPosition(new THREE.Vector3());
    const landing = this.forms[index].localToWorld(new THREE.Vector3(0, 0.36, 0));
    const end = landing.clone().add(new THREE.Vector3(0, 0.12, 0));
    const control = start.clone().lerp(end, 0.5);
    control.x = Math.min(start.x, end.x) - 2;
    control.y = Math.max(start.y, end.y) + 1.6;
    if (this.pourGuideTarget !== index) {
      this.pourGuide.geometry.dispose();
      this.pourGuide.geometry = new THREE.TubeGeometry(
        new THREE.QuadraticBezierCurve3(start, control, end), 24, 0.12, 8, false,
      );
      this.pourGuideTarget = index;
    }
    this.pourGuide.visible = true;

    this.bridge[index] = Math.min(1, this.bridge[index] + dt * 0.66);
    this.concrete[index].visible = true;
    this.concrete[index].scale.y = Math.max(0.04, this.bridge[index]);
    this.concrete[index].position.y = 0.22 + 0.08 * this.bridge[index];
    this.pourClock += dt;
    if (this.pourClock > (this.options.reducedMotion ? 0.3 : 0.1)) {
      this.pourClock = 0;
      const top = new THREE.Vector3(0, 0.13, 0);
      this.effect("material-concrete-drop",
        start.clone().add(top), 0.3, 0.65,
        landing.clone().add(top), control.clone().add(top));
    }
    if (this.bridge[index] !== 1) return;
    this.pourGuide.visible = false;
    this.pourGuideTarget = undefined;
    this.pourTarget = this.pourQueue.shift();
    if (this.pourTarget !== undefined) this.truckTarget = FORM_X[this.pourTarget] + MIXER_FORM_OFFSET;
    else if (this.bridge.every(value => value === 1)) this.truckTarget = 2;
    this.options.onActionAccepted();
  }

  private effect(name: ModelName, position: THREE.Vector3, length: number, duration: number, end?: THREE.Vector3, control?: THREE.Vector3): void {
    const visual = this.model(name, length);
    visual.position.copy(position);
    this.scene.add(visual);
    this.effects.push({
      visual, start: position.clone(), end: end?.clone(), control: control?.clone(), age: 0, duration,
      rise: name === "material-stone-0" ? 0.18 : 0, baseScale: visual.scale.x,
    });
  }

  private stepEffects(dt: number): void {
    for (let index = this.effects.length - 1; index >= 0; index--) {
      const effect = this.effects[index];
      effect.age += dt;
      if (effect.age < 0) continue;
      effect.visual.visible = true;
      const progress = Math.min(1, effect.age / effect.duration);
      if (effect.end && effect.control) {
        const remaining = 1 - progress;
        effect.visual.position.copy(effect.start).multiplyScalar(remaining * remaining)
          .addScaledVector(effect.control, 2 * remaining * progress)
          .addScaledVector(effect.end, progress * progress);
      } else if (effect.end) effect.visual.position.copy(effect.start).lerp(effect.end, progress);
      else effect.visual.position.copy(effect.start).add(new THREE.Vector3(0, effect.rise * progress, 0));
      effect.visual.scale.setScalar(effect.baseScale * (1 - (effect.end ? 0.2 : 0.85) * progress));
      if (progress === 1) {
        this.scene.remove(effect.visual);
        this.effects.splice(index, 1);
        if (effect.disposable && effect.visual instanceof THREE.Mesh) {
          effect.visual.geometry.dispose();
          (effect.visual.material as THREE.Material).dispose();
        }
        effect.onComplete?.();
      }
    }
  }

  private updateHint(): void {
    let point: THREE.Vector3 | undefined;
    if (this.activity === "rocks") {
      const rock = this.rocks.find(item => item.state === "track");
      point = rock ? rock.visual.position.clone() : this.rocks.some(item => item.state === "bed")
        ? this.truckX > UNLOAD_X + 0.3 ? new THREE.Vector3(PIT_X, 0.25, 2.25) : new THREE.Vector3(this.truckX - 0.7, 2, ROAD_Z)
        : this.supply.position.clone();
    } else if (this.activity === "build") {
      const next = this.bridge.findIndex(value => value < 1);
      point = next < 0 ? this.supply.position.clone() : this.forms[next].position.clone();
    } else {
      const next = this.dirty.findIndex(Boolean);
      point = next < 0 ? this.supply.position.clone() : this.airplane.localToWorld(this.mud[next].position.clone());
    }
    this.hint.position.set(point.x, Math.max(0.34, point.y + 0.12), point.z);
    this.hint.scale.setScalar(this.options.reducedMotion ? 1 : 1 + Math.sin(this.elapsed * 3.3) * 0.08);
  }

  private snapshot(): FreePlaySnapshot {
    const load = this.rocks.filter(rock => rock.state === "loading" || rock.state === "bed").length;
    const remaining = this.rocks.filter(rock => rock.state === "track").length;
    const action = this.activity === "rocks"
      ? remaining ? "Sentuh batu di rel" : load ? this.truckX > UNLOAD_X + 0.3 ? "Bawa truk ke tempat bongkar" : "Angkat bak truk" : "Sentuh kotak untuk batu lagi"
      : this.activity === "build"
        ? this.bridge.every(value => value === 1) ? "Jembatan jadi! Truk bisa lewat" : "Sentuh cetakan jembatan"
        : this.dirty.some(Boolean) ? "Sentuh lumpur untuk mencuci" : "Bersih! Pesawat terbang";
    return {
      activity: this.activity, load, remaining, delivered: this.delivered,
      bridge: this.bridge.filter(value => value === 1).length,
      dirty: this.dirty.filter(Boolean).length,
      moving: this.truckTarget !== undefined, action, status: action,
    };
  }

  private publish(): void {
    const snapshot = this.snapshot();
    const serialized = JSON.stringify(snapshot);
    if (serialized === this.lastSnapshot) return;
    this.lastSnapshot = serialized;
    this.options.onChange(snapshot);
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("blur", this.clearControls);
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointercancel", this.clearControls);
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
    this.physics.free();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

export async function loadDepotTenang3D(options: DepotTenangGameOptions): Promise<DepotTenang3D> {
  await RAPIER.init();
  const world = new DepotTenang3D(options);
  try {
    await world.load();
    return world;
  } catch (error) {
    world.destroy();
    throw error;
  }
}
