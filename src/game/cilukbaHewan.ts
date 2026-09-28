const ASSET_ROOT = `${import.meta.env.BASE_URL}assets/cilukba-hewan/`;

const animals = ["kucing", "anjing", "ayam", "bebek", "kelinci", "sapi", "kuda", "kambing", "katak", "burung", "monyet", "gajah"] as const;
type Animal = (typeof animals)[number];
const animalImages: Record<Animal, string> = {
  kucing: "cat.svg",
  anjing: "dog.svg",
  ayam: "chicken.svg",
  bebek: "duck.svg",
  kelinci: "rabbit.svg",
  sapi: "cow.svg",
  kuda: "horse.svg",
  kambing: "goat.svg",
  katak: "frog.svg",
  burung: "bird.svg",
  monyet: "monkey.svg",
  gajah: "elephant.svg",
};
const hidingPlaces = ["bush.svg", "basket.svg", "hay.svg"] as const;

export type CilukbaGame = {
  setPaused(paused: boolean): void;
  destroy(): void;
};

type Options = {
  parent: HTMLElement;
  reducedMotion: boolean;
  volume: number;
  onStatus(status: string): void;
};

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export async function loadCilukbaHewan(options: Options): Promise<CilukbaGame> {
  const resources = [
    "garden.svg",
    "credits.html",
    ...Object.values(animalImages),
    ...hidingPlaces,
    ...animals.flatMap(animal => [`name-${animal}.mp3`, ...(animal === "kelinci" ? [] : [`sound-${animal}.mp3`])]),
  ];
  await Promise.all(resources.map(async file => {
    const response = await fetch(`${ASSET_ROOT}${file}`);
    if (!response.ok) throw new Error(`Could not load ${file}`);
    await response.arrayBuffer();
  }));

  const board = document.createElement("div");
  board.className = "cilukba-board";
  board.style.backgroundImage = `url("${ASSET_ROOT}garden.svg")`;
  board.dataset.reducedMotion = String(options.reducedMotion);
  board.innerHTML = `
    <p class="cilukba-instruction">Siapa yang bersembunyi?</p>
    <div class="cilukba-spots"></div>
    <div class="cilukba-bottom">
      <p class="cilukba-message" aria-live="polite"></p>
      <button class="cilukba-again" type="button" hidden aria-label="Cilukba lagi"><img src="${ASSET_ROOT}rabbit.svg" alt="" /> <span>Cilukba lagi!</span></button>
    </div>
  `;
  const spots = board.querySelector<HTMLDivElement>(".cilukba-spots")!;
  const message = board.querySelector<HTMLElement>(".cilukba-message")!;
  const again = board.querySelector<HTMLButtonElement>(".cilukba-again")!;
  let bag: Animal[] = [];
  let revealed = 0;
  let paused = false;
  let destroyed = false;
  let currentSound: HTMLAudioElement | undefined;

  function stopSound(): void {
    currentSound?.pause();
    currentSound = undefined;
  }

  function play(file: string, next?: string): void {
    stopSound();
    if (options.volume === 0 || paused || destroyed) return;
    const sound = new Audio(`${ASSET_ROOT}${file}`);
    sound.volume = options.volume;
    currentSound = sound;
    if (next) sound.addEventListener("ended", () => {
      if (currentSound === sound && !paused && !destroyed) play(next);
    }, { once: true });
    void sound.play().catch(() => { if (currentSound === sound) currentSound = undefined; });
  }

  function beginRound(): void {
    if (bag.length === 0) bag = shuffle(animals);
    const round = bag.splice(0, 3);
    revealed = 0;
    again.hidden = true;
    message.textContent = "Ketuk yang bersembunyi!";
    options.onStatus("Cari tiga hewan yang bersembunyi");
    spots.replaceChildren();
    for (const [index, animal] of round.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cilukba-spot";
      button.setAttribute("aria-label", `Cari hewan di tempat ${index + 1}`);
      button.innerHTML = `
        <img class="cilukba-animal" src="${ASSET_ROOT}${animalImages[animal]}" alt="" draggable="false" />
        <img class="cilukba-cover" src="${ASSET_ROOT}${hidingPlaces[index]}" alt="" draggable="false" />
      `;
      button.addEventListener("animationend", () => button.classList.remove("is-reacting"));
      button.addEventListener("click", () => {
        if (paused || destroyed) return;
        if (!button.classList.contains("is-revealed")) {
          button.classList.add("is-revealed");
          button.setAttribute("aria-label", `${animal}, ketuk untuk melihat lagi`);
          revealed += 1;
          message.textContent = `${animal[0].toUpperCase()}${animal.slice(1)}!`;
          options.onStatus(`${animal} ditemukan`);
          play(`name-${animal}.mp3`, animal === "kelinci" ? undefined : `sound-${animal}.mp3`);
          if (revealed === 3) again.hidden = false;
        } else {
          if (!button.classList.contains("is-reacting")) button.classList.add("is-reacting");
          play(animal === "kelinci" ? `name-${animal}.mp3` : `sound-${animal}.mp3`);
        }
      });
      spots.append(button);
    }
  }

  again.addEventListener("click", () => {
    if (paused || destroyed) return;
    stopSound();
    beginRound();
  });
  options.parent.append(board);
  beginRound();
  return {
    setPaused(value) {
      paused = value;
      if (paused) stopSound();
    },
    destroy() {
      destroyed = true;
      stopSound();
      board.remove();
    },
  };
}
