import type { DepotTenangFeedback, DepotTenangState } from "./depotTenangTypes";

export type DepotTenangGameOptions = {
  parent: HTMLElement;
  onStateChange: (state: DepotTenangState) => void;
  onFeedback: (feedback: DepotTenangFeedback) => void;
  onActionAccepted: () => void;
  onJourneyComplete: (completedJourneys: number) => void;
  onPlayCycleComplete: () => void;
  reducedMotion: boolean;
};

export type DepotTenangGame = {
  destroy(removeCanvas?: boolean): void;
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

  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
    height: 540,
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
      },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: new DepotTenangScene({
      onStateChange: options.onStateChange,
      onFeedback: options.onFeedback,
      onActionAccepted: options.onActionAccepted,
      onJourneyComplete: options.onJourneyComplete,
      onPlayCycleComplete: options.onPlayCycleComplete,
      reducedMotion: options.reducedMotion,
    }),
  });
}
