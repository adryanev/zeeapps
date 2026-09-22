export type PlayActivity = "rocks" | "build" | "wash";

export type FreePlaySnapshot = {
  activity: PlayActivity;
  load: number;
  delivered: number;
  remaining: number;
  bridge: number;
  dirty: number;
  moving: boolean;
  action: string;
  status: string;
};

export type DepotTenangCallbacks = {
  onReady: () => void;
  onChange: (snapshot: FreePlaySnapshot) => void;
  onActionAccepted: () => void;
  reducedMotion: boolean;
};
