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

type Action = {
  icon: string;
  label: string;
  path: readonly [string, string, string];
};

const ACTIONS: readonly Action[] = [
  { icon: "🍎", label: "Apel jatuh", path: ["translate(0,-160px) rotate(-20deg)", "translate(0,25px) rotate(8deg)", "translate(0,65px) rotate(20deg)"] },
  { icon: "🎈", label: "Balon terbang", path: ["translate(0,110px) scale(.6)", "translate(-25px,-30px) scale(1.1)", "translate(20px,-170px) scale(.8)"] },
  { icon: "🐛", label: "Cacing merayap", path: ["translate(-150px,80px) rotate(-15deg)", "translate(0,65px) rotate(15deg)", "translate(150px,80px) rotate(-15deg)"] },
  { icon: "🥁", label: "Drum berdentum", path: ["scale(.5) rotate(-15deg)", "scale(1.4) rotate(12deg)", "scale(.8) rotate(-8deg)"] },
  { icon: "🧊", label: "Es meluncur", path: ["translate(-150px,-80px) rotate(-30deg)", "translate(0,30px) rotate(15deg)", "translate(150px,90px) rotate(60deg)"] },
  { icon: "🌸", label: "Bunga mekar", path: ["scale(.1) rotate(-90deg)", "scale(1.25) rotate(15deg)", "scale(1) rotate(0deg)"] },
  { icon: "🫧", label: "Gelembung naik", path: ["translate(-90px,100px) scale(.4)", "translate(0,-10px) scale(1.2)", "translate(75px,-140px) scale(.7)"] },
  { icon: "💛", label: "Hati berdenyut", path: ["scale(.4)", "scale(1.45)", "translateY(-70px) scale(.8)"] },
  { icon: "🐟", label: "Ikan berenang", path: ["translate(-160px,15px) rotate(-20deg)", "translate(0,-15px) rotate(15deg)", "translate(160px,20px) rotate(-10deg)"] },
  { icon: "⏰", label: "Jam bergoyang", path: ["rotate(-45deg) scale(.8)", "rotate(45deg) scale(1.1)", "rotate(-20deg) scale(.9)"] },
  { icon: "🦋", label: "Kupu-kupu berkelok", path: ["translate(-120px,70px) rotate(-25deg)", "translate(0,-70px) rotate(25deg)", "translate(120px,-120px) rotate(-15deg)"] },
  { icon: "💡", label: "Lampu bersinar", path: ["scale(.5) rotate(-10deg)", "scale(1.35) rotate(10deg)", "scale(.9) rotate(-10deg)"] },
  { icon: "☀️", label: "Matahari terbit", path: ["translate(0,120px) scale(.6)", "translate(0,-20px) scale(1.2)", "translate(0,-130px) scale(.9)"] },
  { icon: "🎵", label: "Nada menari", path: ["translate(-120px,50px) rotate(-25deg)", "translate(0,-70px) rotate(25deg)", "translate(120px,10px) rotate(-15deg)"] },
  { icon: "🌊", label: "Ombak bergulung", path: ["translate(-170px,80px) rotate(-30deg)", "translate(0,-30px) rotate(30deg)", "translate(170px,80px) rotate(-30deg)"] },
  { icon: "☂️", label: "Payung terbuka", path: ["translateY(60px) scaleX(.1)", "translateY(-20px) scaleX(1.3)", "translateY(-50px) scaleX(1)"] },
  { icon: "🐹", label: "Quokka mengintip", path: ["translate(-160px,80px) scale(.4)", "translate(-40px,0) scale(1.1)", "translate(-140px,40px) scale(.7)"] },
  { icon: "🚀", label: "Roket meluncur", path: ["translate(-50px,140px) rotate(-25deg)", "translate(0,0) rotate(0deg)", "translate(100px,-180px) rotate(25deg)"] },
  { icon: "🐌", label: "Siput berjalan", path: ["translate(-150px,90px) scale(.7)", "translate(-30px,80px) scale(1)", "translate(100px,90px) scale(.9)"] },
  { icon: "🎩", label: "Topi mendarat", path: ["translate(0,-160px) rotate(30deg)", "translate(0,0) rotate(-10deg)", "translate(0,60px) rotate(20deg)"] },
  { icon: "🐍", label: "Ular meliuk", path: ["translate(-150px,80px) rotate(-30deg)", "translate(0,-30px) rotate(30deg)", "translate(140px,70px) rotate(-30deg)"] },
  { icon: "🏺", label: "Vas bergoyang", path: ["translateY(40px) rotate(-30deg)", "translateY(-20px) rotate(25deg)", "translateY(40px) rotate(-20deg)"] },
  { icon: "🥕", label: "Wortel berputar", path: ["translate(-100px,-100px) rotate(0deg)", "translate(20px,-20px) rotate(180deg)", "translate(120px,80px) rotate(360deg)"] },
  { icon: "🎹", label: "Xilofon berdenting", path: ["translate(-80px,0) scale(.6)", "translate(70px,-50px) scale(1.3)", "translate(-30px,50px) scale(.8)"] },
  { icon: "🪀", label: "Yoyo berayun", path: ["translate(-120px,-110px) rotate(-45deg)", "translate(0,80px) rotate(0deg)", "translate(120px,-110px) rotate(45deg)"] },
  { icon: "🦓", label: "Zebra berlari", path: ["translate(-170px,90px) scale(.8)", "translate(0,25px) scale(1.1)", "translate(170px,90px) scale(.8)"] },
];

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
    <div class="ketuk-trail" aria-hidden="true"></div>
    <p class="ketuk-action" aria-live="polite"></p>
    <p class="ketuk-hint">Tekan tombol atau ketuk layar</p>
  `;
  const monster = board.querySelector<HTMLElement>(".ketuk-monster")!;
  const effects = board.querySelector<HTMLElement>(".ketuk-effects")!;
  const trail = board.querySelector<HTMLElement>(".ketuk-trail")!;
  const actionText = board.querySelector<HTMLElement>(".ketuk-action")!;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const effectTimers = new Set<number>();
  const poses = [
    "translateY(-24px)",
    "translateX(-22px) rotate(-9deg)",
    "translateX(22px) rotate(9deg)",
    "scale(1.1,.9)",
    "rotate(15deg)",
    "scale(.9,1.1)",
  ];
  let audioContext: AudioContext | undefined;
  let monsterAnimation: Animation | undefined;
  let paused = false;
  let destroyed = false;
  let reaction = 0;
  let nextActionIndex = 0;
  let lastSoundAt = -Infinity;

  function chirp(index: number): void {
    if (options.volume === 0 || performance.now() - lastSoundAt < 85) return;
    const AudioContextConstructor = window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
    lastSoundAt = performance.now();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(320 + index * 18, now);
    oscillator.frequency.exponentialRampToValueAtTime(420 + index * 18, now + 0.11);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04 * options.volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
  }

  function react(index: number): void {
    if (paused || destroyed) return;
    const action = ACTIONS[index];
    if (!action) return;
    const key = String.fromCharCode(65 + index);
    board.dataset.action = key;
    actionText.textContent = key + " · " + action.label + "!";
    board.style.setProperty("--ketuk-glow", "hsl(" + (index * 47 % 360) + " 80% 90%)");
    monster.dataset.face = FACES[++reaction % FACES.length];

    const trailIcon = document.createElement("span");
    trailIcon.textContent = action.icon;
    trail.append(trailIcon);
    if (trail.childElementCount > 6) trail.firstElementChild?.remove();

    const effect = document.createElement("span");
    effect.className = "ketuk-effect";
    effect.textContent = action.icon;
    if (effects.childElementCount >= 8) effects.firstElementChild?.remove();
    effects.append(effect);

    const duration = index === 18 ? 1300 : 900;
    if (options.reducedMotion || reducedMotion.matches) {
      effect.style.opacity = "1";
    } else {
      effect.animate([
        { transform: action.path[0], opacity: 0 },
        { transform: action.path[1], opacity: 1, offset: .4 },
        { transform: action.path[2], opacity: 0 },
      ], { duration, easing: "ease-out", fill: "both" });
      monsterAnimation?.cancel();
      monsterAnimation = monster.animate([
        { transform: "none" },
        { transform: poses[index % poses.length], offset: .45 },
        { transform: "none" },
      ], { duration: 440, easing: "ease-out" });
    }
    const timer = window.setTimeout(() => {
      effect.remove();
      effectTimers.delete(timer);
    }, duration);
    effectTimers.add(timer);
    chirp(index);
  }

  function playNext(): void {
    if (paused || destroyed) return;
    react(nextActionIndex);
    nextActionIndex = (nextActionIndex + 1) % ACTIONS.length;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
    const letter = event.key.toUpperCase();
    const index = /^[A-Z]$/.test(letter) ? letter.charCodeAt(0) - 65 : -1;
    if (index < 0 && event.key.length !== 1 && !PLAY_KEYS.has(event.key)) return;
    event.preventDefault();
    if (index >= 0) react(index);
    else playNext();
  }

  board.addEventListener("pointerdown", event => {
    event.preventDefault();
    playNext();
  });
  window.addEventListener("keydown", onKeyDown);
  options.parent.append(board);

  return {
    setPaused(value) {
      paused = value;
      board.dataset.paused = String(value);
      if (value) {
        monsterAnimation?.cancel();
        if (audioContext?.state === "running") void audioContext.suspend().catch(() => {});
      }
    },
    destroy() {
      destroyed = true;
      window.removeEventListener("keydown", onKeyDown);
      for (const timer of effectTimers) window.clearTimeout(timer);
      monsterAnimation?.cancel();
      if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => {});
      board.remove();
    },
  };
}
