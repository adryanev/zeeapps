type Options = {
  parent: HTMLElement;
  reducedMotion: boolean;
  volume: number;
  onStatus: (message: string) => void;
};

export type BeresBeresGame = {
  setPaused: (paused: boolean) => void;
  destroy: () => void;
};

const GROUPS = [
  { id: "mainan", label: "Kotak mainan", image: "toys", items: [
    ["Mobil", "mobil"], ["Boneka", "boneka"], ["Bola", "bola"], ["Robot", "robot"], ["Balok", "balok"],
  ] },
  { id: "makanan", label: "Nampan makanan", image: "food", items: [
    ["Apel", "apel"], ["Pisang", "pisang"], ["Jeruk", "jeruk"], ["Pir", "pir"], ["Roti", "roti"],
  ] },
  { id: "pakaian", label: "Keranjang cucian", image: "clothes", items: [
    ["Kaus", "kaus"], ["Celana", "celana"], ["Kaus kaki", "kaus-kaki"], ["Jaket", "jaket"], ["Rok", "rok"],
  ] },
  { id: "gambar", label: "Tempat alat menggambar", image: "art", items: [
    ["Krayon", "krayon"], ["Pensil warna", "pensil-warna"], ["Kertas", "kertas"], ["Kuas", "kuas"], ["Palet", "palet"],
  ] },
  { id: "alas-kaki", label: "Rak alas kaki", image: "shoes", items: [
    ["Sepatu olahraga", "sepatu-olahraga"], ["Sepatu sekolah", "sepatu-sekolah"], ["Sandal jepit", "sandal-jepit"],
    ["Sandal bertali", "sandal-bertali"], ["Sepatu bot", "sepatu-bot"],
  ] },
] as const;

type Group = (typeof GROUPS)[number];
type Item = { label: string; image: string; group: Group };

const asset = (name: string): string => import.meta.env.BASE_URL + "assets/beres-beres/" + name + ".svg";

export function loadBeresBeresRumah(options: Options): BeresBeresGame {
  const board = document.createElement("div");
  board.className = "beres-board";
  board.dataset.reducedMotion = String(options.reducedMotion);
  board.style.backgroundImage = "url('" + asset("room") + "')";
  board.innerHTML =
    '<div class="beres-friend"><img alt="" src="' + asset("friend") + '" draggable="false"></div>' +
    '<p class="beres-message" role="status" aria-live="polite">Pilih benda, lalu tempat bergambarnya.</p>' +
    '<div class="beres-destinations" role="group" aria-label="Tempat untuk benda"></div>' +
    '<div class="beres-items" role="group" aria-label="Benda yang akan dirapikan"></div>' +
    '<div class="beres-finish" hidden><div class="beres-finish__card">' +
      '<img alt="" src="' + asset("friend") + '">' +
      '<p>Rumah sudah rapi!</p>' +
      '<button class="beres-replay" type="button">Main lagi</button>' +
      '<p class="beres-companion">Companion, yuk rapikan satu benda sungguhan bersama.</p>' +
    '</div></div>';
  const message = board.querySelector<HTMLElement>(".beres-message")!;
  const destinations = board.querySelector<HTMLElement>(".beres-destinations")!;
  const items = board.querySelector<HTMLElement>(".beres-items")!;
  const finish = board.querySelector<HTMLElement>(".beres-finish")!;
  const replay = board.querySelector<HTMLButtonElement>(".beres-replay")!;
  const itemCursor = GROUPS.map(() => 0);
  let round = 0;
  let placed = 0;
  let selected: Item | undefined;
  let paused = false;
  let destroyed = false;
  let pointerStart: { id: number; x: number; y: number; button: HTMLButtonElement } | undefined;
  let suppressClick = false;
  const mistakes = new Map<string, number>();

  function say(text: string): void {
    message.textContent = text;
    options.onStatus(text);
    if (options.volume === 0 || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.volume = options.volume;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function choose(item: Item): void {
    if (paused || destroyed || !finish.hidden) return;
    selected = item;
    destinations.querySelectorAll<HTMLElement>(".beres-destination--hint").forEach(button => {
      button.classList.remove("beres-destination--hint");
    });
    items.querySelectorAll<HTMLButtonElement>(".beres-item").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.item === item.image));
    });
    say(item.label + " ke mana ya?");
  }

  function place(groupId: string): void {
    if (paused || destroyed || !finish.hidden) return;
    if (!selected) {
      say("Pilih benda dulu, yuk.");
      return;
    }
    if (selected.group.id !== groupId) {
      const count = (mistakes.get(selected.image) ?? 0) + 1;
      mistakes.set(selected.image, count);
      if (count >= 2) {
        destinations.querySelectorAll<HTMLElement>(".beres-destination").forEach(button => {
          button.classList.toggle("beres-destination--hint", button.dataset.place === selected?.group.id);
        });
      }
      say("Coba lihat tempat bergambar yang lain.");
      return;
    }

    const destination = destinations.querySelector<HTMLElement>('[data-place="' + groupId + '"]')!;
    destination.classList.remove("beres-destination--hint");
    destination.classList.add("beres-destination--filled");
    const itemButton = items.querySelector<HTMLButtonElement>('[data-item="' + selected.image + '"]')!;
    const name = selected.label;
    itemButton.remove();
    selected = undefined;
    placed += 1;
    if (placed === 3) {
      say("Rumah sudah rapi! Yuk, bermain lagi.");
      finish.hidden = false;
      replay.focus();
    } else {
      say(name + " sudah rapi. Pilih benda berikutnya.");
      items.querySelector<HTMLButtonElement>(".beres-item")?.focus();
    }
  }

  function addPictureButton(
    parent: HTMLElement,
    className: string,
    image: string,
    label: string,
    dataName: string,
    dataValue: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset[dataName] = dataValue;
    button.setAttribute("aria-label", label);
    if (dataName === "item") button.setAttribute("aria-pressed", "false");
    const picture = document.createElement("img");
    picture.src = asset(image);
    picture.alt = "";
    picture.draggable = false;
    button.append(picture);
    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    button.addEventListener("click", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      onClick();
    });
    parent.append(button);
    return button;
  }

  function beginRound(): void {
    placed = 0;
    selected = undefined;
    suppressClick = false;
    pointerStart = undefined;
    mistakes.clear();
    finish.hidden = true;
    destinations.replaceChildren();
    items.replaceChildren();
    const current = round++;
    board.dataset.round = String(round);
    const groups = Array.from({ length: 3 }, (_, offset) => GROUPS[(current * 3 + offset) % GROUPS.length]);
    const drawGroups = current % 2 ? [...groups].reverse() : groups;
    for (const group of drawGroups) {
      addPictureButton(destinations, "beres-destination", group.image, group.label, "place", group.id,
        () => place(group.id));
    }
    for (const group of groups) {
      const index = GROUPS.indexOf(group);
      const [label, image] = group.items[itemCursor[index]++ % group.items.length];
      const item: Item = { label, image, group };
      addPictureButton(items, "beres-item", image, label, "item", image, () => choose(item));
    }
    say("Pilih benda, lalu tempat bergambarnya.");
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (paused || destroyed || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    if (!options.parent.contains(document.activeElement)) return;
    const buttons = [
      ...items.querySelectorAll<HTMLButtonElement>(".beres-item"),
      ...destinations.querySelectorAll<HTMLButtonElement>(".beres-destination"),
      replay,
    ]
      .filter(button => button.getClientRects().length > 0);
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    buttons[(index + step + buttons.length) % buttons.length].focus();
    event.preventDefault();
  }

  items.addEventListener("pointerdown", event => {
    if (paused || destroyed) return;
    const button = (event.target as Element).closest<HTMLButtonElement>(".beres-item");
    if (!button) return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, button };
    button.setPointerCapture(event.pointerId);
  });
  items.addEventListener("pointermove", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.hypot(dx, dy) < 12 && !pointerStart.button.classList.contains("beres-item--dragging")) return;
    pointerStart.button.classList.add("beres-item--dragging");
    pointerStart.button.style.translate = dx + "px " + dy + "px";
  });
  items.addEventListener("pointerup", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const { button } = pointerStart;
    pointerStart = undefined;
    if (!button.classList.contains("beres-item--dragging")) return;
    button.style.pointerEvents = "none";
    const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-place]");
    button.style.pointerEvents = "";
    button.classList.remove("beres-item--dragging");
    button.style.translate = "";
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 0);
    if (destination) {
      suppressClick = false;
      button.click();
      suppressClick = true;
      place(destination.dataset.place!);
    }
  });
  items.addEventListener("pointercancel", () => {
    if (!pointerStart) return;
    pointerStart.button.classList.remove("beres-item--dragging");
    pointerStart.button.style.translate = "";
    pointerStart = undefined;
  });
  replay.addEventListener("click", beginRound);
  window.addEventListener("keydown", onKeyDown);
  options.parent.append(board);
  beginRound();

  return {
    setPaused(value) {
      paused = value;
      board.dataset.paused = String(value);
      if (value) {
        pointerStart?.button.classList.remove("beres-item--dragging");
        if (pointerStart) pointerStart.button.style.translate = "";
        pointerStart = undefined;
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      }
    },
    destroy() {
      destroyed = true;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      window.removeEventListener("keydown", onKeyDown);
      board.remove();
    },
  };
}
