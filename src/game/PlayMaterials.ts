import Phaser from "phaser";
import models from "./generated/playMaterials.json";

type MaterialKey = keyof typeof models;
type Point = {x:number; y:number};

export function preloadPlayMaterials(scene: Phaser.Scene): void {
  for (const [key, model] of Object.entries(models)) {
    scene.load.image("material-" + key, import.meta.env.BASE_URL + "assets/depot-tenang-v2/" + model.file);
  }
}

/** Reuses rendered props and a bounded stream of droplets for the active activity. */
export class PlayMaterials {
  readonly pool: Phaser.GameObjects.Image;
  readonly molds: Phaser.GameObjects.Image[];
  readonly mud: Phaser.GameObjects.Image[];
  private drops: Phaser.GameObjects.Image[];
  private splash: Phaser.GameObjects.Image;
  private hose: Phaser.GameObjects.Image;
  private stream: Phaser.GameObjects.Graphics;
  private feedback: Phaser.GameObjects.Graphics;
  private mudOpacity = [1, 1, 1, 1, 1];
  private bursts: {kind: "settle" | "clean" | "complete"; x: number; y: number; age: number}[] = [];

  constructor(private scene: Phaser.Scene) {
    this.pool = this.image("pool", 250, 416, 3);
    this.molds = Array.from({length: 3}, (_, i) => this.image("mold-0", 154 + i * 95, 400, 4));
    this.mud = Array.from({length: 5}, () => this.image("mud", 0, 0, 21));
    this.stream = scene.add.graphics().setDepth(22);
    this.drops = Array.from({length: 40}, () => this.image("water-drop", 0, 0, 22));
    this.splash = this.image("water-splash", 0, 0, 23);
    this.hose = this.image("water-hose", 0, 0, 16);
    this.feedback = scene.add.graphics().setDepth(24);
    this.hide();
  }

  private image(key: MaterialKey, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const model = models[key];
    return this.scene.add.image(x, y, "material-" + key).setDisplaySize(model.width, model.height).setDepth(depth);
  }

  hide(): void {
    for (const image of [this.pool, ...this.molds, ...this.mud, ...this.drops, this.splash, this.hose]) image.setVisible(false);
    this.stream.clear();
  }

  clearFeedback(): void {
    this.bursts = [];
    this.feedback.clear();
    this.mudOpacity.fill(0);
    this.hide();
  }

  burst(kind: "settle" | "clean" | "complete", x: number, y: number): void {
    // Bound simultaneous feedback even when several touch targets are hit at once.
    if (this.bursts.length === 12) this.bursts.shift();
    this.bursts.push({kind, x, y, age: 0});
  }

  step(dt: number, reducedMotion: boolean): void {
    this.feedback.clear();
    this.bursts = this.bursts.filter(burst => {
      burst.age += dt;
      const t = burst.age / (burst.kind === "complete" ? 1.1 : 0.65);
      if (t >= 1) return false;
      const fade = (1 - t) * (1 - t);
      const travel = reducedMotion ? 0 : 1 - (1 - t) ** 3;
      const count = reducedMotion ? 3 : burst.kind === "complete" ? 9 : 7;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const radius = 8 + travel * (burst.kind === "complete" ? 48 : 25);
        const x = burst.x + Math.cos(angle) * radius;
        const y = burst.y + Math.sin(angle) * radius * 0.55 - travel * 12;
        if (burst.kind === "settle") {
          this.feedback.fillStyle(0xdccba8, fade * 0.7).fillEllipse(x, y, 8 + travel * 10, 5 + travel * 6);
        } else if (burst.kind === "clean") {
          this.feedback.lineStyle(1.5, 0xf2ffff, fade).strokeCircle(x, y, 2 + travel * 4);
          this.feedback.fillStyle(0xa6e1df, fade * 0.35).fillCircle(x, y, 2 + travel * 4);
        } else {
          const size = reducedMotion ? 2 : 3 + Math.sin(Math.PI * t) * 3;
          this.feedback.fillStyle(i % 2 ? 0xffefb0 : 0xffffff, fade);
          this.feedback.fillPoints([
            {x, y: y - size}, {x: x + size * 0.3, y: y - size * 0.3},
            {x: x + size, y}, {x: x + size * 0.3, y: y + size * 0.3},
            {x, y: y + size}, {x: x - size * 0.3, y: y + size * 0.3},
            {x: x - size, y}, {x: x - size * 0.3, y: y - size * 0.3},
          ].map(point => new Phaser.Math.Vector2(point.x, point.y)), true);
        }
      }
      return true;
    });
  }

  showBridge(fill: readonly number[]): void {
    this.pool.setVisible(true).setPosition(250, 414).setDisplaySize(380, 126).setAlpha(1);
    this.molds.forEach((image, i) => {
      image.setVisible(true).setTexture("material-mold-" + Math.round(fill[i] * 6));
    });
  }

  bridgeContactY(): number {
    return this.molds[0].y + models["mold-6"].contactY;
  }

  showWash(dirty: readonly boolean[], points: readonly Point[], grounded: boolean, truck: Point, dt: number, reducedMotion: boolean): void {
    this.pool.setVisible(true).setPosition(285, 421).setDisplaySize(360, 88).setAlpha(0.85);
    this.mud.forEach((image, i) => {
      this.mudOpacity[i] = dirty[i] ? 1 : Math.max(0, this.mudOpacity[i] - dt * 3.5);
      const opacity = this.mudOpacity[i];
      const shrink = reducedMotion ? 1 : 0.6 + 0.4 * opacity;
      image.setPosition(points[i].x, points[i].y + (reducedMotion ? 0 : (1 - opacity) * 10))
        .setDisplaySize(70 * shrink, 46 * shrink).setAlpha(opacity).setVisible(grounded && opacity > 0);
    });
    this.hose.setVisible(true).setPosition(truck.x - 80, truck.y + 30);
  }

  waterOutlet(): Point {
    const model = models["water-hose"];
    return {x: this.hose.x + model.contactX, y: this.hose.y + model.contactY};
  }

  pour(from: Point, to: Point, time: number, reducedMotion: boolean): void {
    this.flow("concrete", from, to, time, reducedMotion);
  }

  spray(from: Point, to: Point, time: number, reducedMotion: boolean): void {
    this.flow("water", from, to, time, reducedMotion);
  }

  private flow(kind: "water" | "concrete", from: Point, to: Point, time: number, reducedMotion: boolean): void {
    const water = kind === "water";
    const clock = reducedMotion ? 0 : time;
    const control = {x: (from.x + to.x) / 2, y: water ? Math.min(from.y, to.y) - 65 : (from.y + to.y) / 2};
    const pointAt = (t: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(
      (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t * t * to.x,
      (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t * t * to.y,
    );
    const path = Array.from({length: 33}, (_, i) => pointAt(i / 32));
    // A continuous core joins the nozzle to the hit point; droplets carry the motion.
    this.stream.lineStyle(water ? 9 : 8, water ? 0x459aaa : 0x797e76, water ? 0.35 : 0.9).strokePoints(path, false);
    this.stream.lineStyle(4, water ? 0xa5eff0 : 0xc4c7b9, 0.9).strokePoints(path, false);
    if (water) this.stream.lineStyle(1.4, 0xf0ffff, 0.9).strokePoints(path, false);
    const along = water ? 28 : 12;
    const count = reducedMotion ? 0 : water ? 40 : 20;
    this.drops.forEach((image, i) => {
      if (i >= count) return;
      const t = (i / (i < along ? along : count - along) + clock * (water ? 1.8 : 1.3)) % 1;
      let point: Point;
      let rotation = 0;
      if (i < along) {
        point = pointAt(t);
        const tangent = pointAt(Math.min(1, t + 0.01));
        rotation = Math.atan2(tangent.y - point.y, tangent.x - point.x) - Math.PI / 2;
      } else {
        const direction = i % 2 ? 1 : -1;
        point = {
          x: to.x + direction * t * (water ? 18 + (i % 4) * 6 : 10),
          y: to.y - Math.sin(t * Math.PI) * (water ? 18 : 7) + t * t * 12,
        };
        rotation = direction * t;
      }
      image.setTexture("material-" + kind + "-drop").setVisible(true).setPosition(point.x, point.y)
        .setRotation(rotation).setDisplaySize(water ? 5 : 8, water ? 12 : 11)
        .setAlpha(i < along ? 0.9 : 1 - t);
    });
    const breath = reducedMotion ? 1 : 1 + Math.sin(time * 17) * 0.07;
    this.splash.setTexture("material-" + kind + "-splash").setVisible(true).setPosition(to.x, to.y + 4)
      .setDisplaySize((water ? 62 : 40) * breath, (water ? 42 : 27) / breath).setAlpha(0.85);
    if (water) {
      for (let i = 0; i < 3; i++) {
        const phase = (clock * 1.2 + i / 3) % 1;
        this.stream.lineStyle(1.5, 0xd4ffff, (1 - phase) * 0.65)
          .strokeEllipse(to.x, to.y + 7, 12 + phase * 54, 4 + phase * 14);
      }
    }
  }
}
