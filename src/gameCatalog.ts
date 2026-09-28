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
  {
    id: "cilukba-hewan",
    title: "Cilukba Hewan",
    description: "Temukan hewan yang bersembunyi. Ketuk untuk melihat dan mendengar mereka!",
    companionPrompt: "Ada siapa di balik semak? Yuk, lihat bersama!",
    launchLabel: "Mulai Cilukba Hewan",
    artwork: {
      decorations: [],
      layers: [
        { image: "assets/cilukba-hewan/cat.svg", layer: "cat" },
        { image: "assets/cilukba-hewan/rabbit.svg", layer: "rabbit" },
        { image: "assets/cilukba-hewan/bush.svg", layer: "bush" },
      ],
    },
  },
  {
    id: "ketuk-ketuk",
    title: "Ketuk-Ketuk",
    description: "Tekan tombol keyboard atau ketuk layar. Monster kecil ini akan melompat dan berkicau!",
    companionPrompt: "Coba tekan tombol bersama. Wajah apa yang dibuat monster?",
    launchLabel: "Mulai Ketuk-Ketuk",
    artwork: {
      decorations: ["ketuk-monster", "ketuk-bubble"],
      layers: [],
    },
  },
] as const satisfies readonly GameDefinition[];

export type GameId = (typeof gameCatalog)[number]["id"];
