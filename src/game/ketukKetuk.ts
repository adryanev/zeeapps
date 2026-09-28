export type KetukGame = {
  setPaused(paused: boolean): void;
  destroy(): void;
};

type Options = {
  parent: HTMLElement;
  reducedMotion: boolean;
  volume: number;
};

const PLAY_KEYS = new Set(["Enter", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
const FACES = ["smile", "wow", "grin"] as const;

export function loadKetukKetuk(options: Options): KetukGame {
  const board = document.createElement("div");
  board.className = "ketuk-board";
  board.dataset.reducedMotion = String(options.reducedMotion);
  board.setAttribute("role", "button");
  board.setAttribute("tabindex", "0");
  board.setAttribute("aria-label", "Ketuk-Ketuk. Tekan tombol atau ketuk layar untuk mengajak monster bermain.");
  board.innerHTML = `
    <div class="ketuk-scene" aria-hidden="true">
      <div class="ketuk-glow"></div>
      <div class="ketuk-monster" data-face="smile">
        <span class="ketuk-horn ketuk-horn--left"></span>
        <span class="ketuk-horn ketuk-horn--right"></span>
        <span class="ketuk-arm ketuk-arm--left"></span>
        <span class="ketuk-arm ketuk-arm--right"></span>
        <div class="ketuk-body">
          <span class="ketuk-eye ketuk-eye--left"></span>
          <span class="ketuk-eye ketuk-eye--right"></span>
          <span class="ketuk-mouth"></span>
        </div>
        <span class="ketuk-foot ketuk-foot--left"></span>
        <span class="ketuk-foot ketuk-foot--right"></span>
      </div>
      <div class="ketuk-effects"></div>
    </div>
    <p class="ketuk-hint">Tekan tombol atau ketuk layar</p>
  `;
  const monster = board.querySelector<HTMLElement>(".ketuk-monster")!;
  const effects = board.querySelector<HTMLElement>(".ketuk-effects")!;
  let audioContext: AudioContext | undefined;
  let jump: Animation | undefined;
  let effectTimer: number | undefined;
  let paused = false;
  let destroyed = false;
  let lastReactionAt = -Infinity;
  let reaction = 0;

  function chirp(variant: number): void {
    if (options.volume === 0) return;
    const AudioContextConstructor = window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(370 + variant * 65, now);
    oscillator.frequency.exponentialRampToValueAtTime(520 + variant * 65, now + 0.11);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04 * options.volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
  }

  function react(): void {
    if (paused || destroyed) return;
    const now = performance.now();
    if (now - lastReactionAt < 110) return;
    const fast = now - lastReactionAt < 350;
    lastReactionAt = now;
    const variant = ++reaction % FACES.length;
    monster.dataset.face = FACES[variant];
    board.dataset.color = String(variant);
    jump?.cancel();
    if (!options.reducedMotion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      jump = monster.animate([
        { transform: "translateY(0) rotate(0deg)" },
        { transform: `translateY(${fast ? -34 : -23}px) rotate(${variant === 1 ? 6 : -6}deg)` },
        { transform: "translateY(0) rotate(0deg)" },
      ], { duration: fast ? 300 : 390, easing: "ease-out" });
    }

    const group = document.createElement("div");
    group.className = "ketuk-effect-group";
    for (let index = 0; index < (fast ? 5 : 3); index += 1) {
      const bubble = document.createElement("span");
      bubble.className = "ketuk-bubble";
      bubble.style.setProperty("--x", `${(index - (fast ? 2 : 1)) * 48}px`);
      bubble.style.setProperty("--rise", `${-45 - (index % 2) * 22}px`);
      group.append(bubble);
    }
    effects.replaceChildren(group);
    if (effectTimer !== undefined) window.clearTimeout(effectTimer);
    effectTimer = window.setTimeout(() => effects.replaceChildren(), 750);
    chirp(variant);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
    if (event.key.length !== 1 && !PLAY_KEYS.has(event.key)) return;
    event.preventDefault();
    react();
  }

  board.addEventListener("pointerdown", event => {
    event.preventDefault();
    react();
  });
  window.addEventListener("keydown", onKeyDown);
  options.parent.append(board);

  return {
    setPaused(value) {
      paused = value;
      board.dataset.paused = String(value);
      if (value) {
        jump?.cancel();
        void audioContext?.suspend();
      }
    },
    destroy() {
      destroyed = true;
      window.removeEventListener("keydown", onKeyDown);
      if (effectTimer !== undefined) window.clearTimeout(effectTimer);
      jump?.cancel();
      void audioContext?.close();
      board.remove();
    },
  };
}
