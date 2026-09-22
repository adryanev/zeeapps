import type { DepotTenangCallbacks, PlayActivity } from "./depotTenangTypes";

export type DepotTenangGameOptions = DepotTenangCallbacks & { parent: HTMLElement };

export type DepotTenangGame = {
  destroy(removeCanvas?: boolean): void;
  selectActivity(activity: PlayActivity): void;
  interact(): void;
  setPaused(paused: boolean): void;
  clearControls(): void;
};

type PhaserModule = typeof import("phaser");
type DepotTenangSceneModule = typeof import("./DepotTenangScene");

export type DepotTenangGameLoader = () => Promise<[PhaserModule, DepotTenangSceneModule]>;

export function loadDepotTenangGameDependencies(): Promise<
  [PhaserModule, DepotTenangSceneModule]
> {
  return Promise.all([
    import("phaser").then(({ default: Phaser }) => Phaser),
    import("./DepotTenangScene"),
  ]);
}

export async function createDepotTenangGame(
  options: DepotTenangGameOptions,
  loadDependencies: DepotTenangGameLoader,
): Promise<DepotTenangGame> {
  const [Phaser, { DepotTenangScene }] = await loadDependencies();

  const renderSize = () => {
    const bounds = options.parent.getBoundingClientRect();
    const width = Math.min(bounds.width, bounds.height * 16 / 9) * window.devicePixelRatio;
    const units = Math.min(240, Math.max(60, Math.ceil(width / 16)));
    return {width:units * 16, height:units * 9};
  };
  const initial = renderSize();
  const scene = new DepotTenangScene(options);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: initial.width,
    height: initial.height,
    parent: options.parent,
    backgroundColor: "#b8d9dc",
    input: {
      keyboard: true,
    },
    physics: {
      default: "matter",
      matter: {
        gravity: { x: 0, y: 0.9 },
        enableSleeping: true,
        debug: false,
        runner: {
          frameDeltaSmoothing: false,
          maxFrameTime: 100,
          maxUpdates: 6,
        },
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
  });
  const updateSize = () => {
    if (game.isBooted) {
      game.scale.getParentBounds();
      const size = renderSize();
      if (size.width !== game.scale.width || size.height !== game.scale.height) {
        game.scale.setGameSize(size.width, size.height);
      } else game.scale.refresh();
    }
  };
  const resize = new ResizeObserver(updateSize);
  resize.observe(options.parent);
  window.addEventListener("resize", updateSize);
  return {
    destroy: (removeCanvas) => {
      resize.disconnect();
      window.removeEventListener("resize", updateSize);
      game.destroy(removeCanvas ?? true);
    },
    selectActivity: (activity) => scene.selectActivity(activity),
    interact: () => scene.interact(),
    setPaused: (paused) => scene.setPaused(paused),
    clearControls: () => scene.clearControls(),
  };
}
