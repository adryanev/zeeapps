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

type DepotTenangGame = {
  destroy(removeCanvas?: boolean): void;
};

export async function createDepotTenangGame(options: DepotTenangGameOptions): Promise<DepotTenangGame> {
  const [{ default: Phaser }, { DepotTenangScene }] = await Promise.all([
    import("phaser"),
    import("./DepotTenangScene"),
  ]);

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
