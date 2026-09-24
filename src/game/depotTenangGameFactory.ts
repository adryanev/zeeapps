import type { DepotTenangCallbacks, PlayActivity } from "./depotTenangTypes";

export type DepotTenangGameOptions = DepotTenangCallbacks & { parent: HTMLElement };

export type DepotTenangGame = {
  destroy(removeCanvas?: boolean): void;
  selectActivity(activity: PlayActivity): void;
  interact(): void;
  setPaused(paused: boolean): void;
  clearControls(): void;
};

type DepotTenang3DModule = typeof import("./DepotTenang3D");

export type DepotTenangGameLoader = () => Promise<DepotTenang3DModule>;

export function loadDepotTenangGameDependencies(): Promise<DepotTenang3DModule> {
  return import("./DepotTenang3D");
}

export async function createDepotTenangGame(
  options: DepotTenangGameOptions,
  loadDependencies: DepotTenangGameLoader,
): Promise<DepotTenangGame> {
  const { loadDepotTenang3D } = await loadDependencies();
  const world = await loadDepotTenang3D(options);
  return {
    destroy: () => world.destroy(),
    selectActivity: activity => world.selectActivity(activity),
    interact: () => world.interact(),
    setPaused: paused => world.setPaused(paused),
    clearControls: () => world.clearControls(),
  };
}
