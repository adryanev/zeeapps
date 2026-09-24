export type GameDefinition = {
  id: string;
  title: string;
  description: string;
  companionPrompt: string;
  launchLabel: string;
  artwork: {
    decorations: readonly string[];
    layers: ReadonlyArray<{ image: string; layer: string }>;
  };
};

/** The Playroom lists only Games that can be opened today. */
export const gameCatalog = [
  {
    id: "depot-tenang",
    title: "Depot Tenang",
    description: "Angkut batu, bangun jembatan, dan cuci pesawat. Sentuh mainannya untuk melihat apa yang terjadi.",
    companionPrompt: "Lihat, ada batu di rel! Apa yang terjadi kalau kita pindahkan?",
    launchLabel: "Mulai Depot Tenang",
    artwork: {
      decorations: ["sun", "rail", "road"],
      layers: [
        { image: "assets/depot-tenang-v2/train-locomotive-sol.webp", layer: "train" },
        { image: "assets/depot-tenang-v2/airplane-body.webp", layer: "airplane" },
        { image: "assets/depot-tenang-v2/truck-mining-dump-body.webp", layer: "truck" },
      ],
    },
  },
] as const satisfies readonly GameDefinition[];

export type GameId = (typeof gameCatalog)[number]["id"];
