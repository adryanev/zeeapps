import "./styles.css";
import {
  isSoundProfile,
  loadCompanionSettings,
  saveCompanionSettings,
  type CompanionSettings,
  type SoundProfile,
} from "./companionSettings";
import { installCompanionGate } from "./companionGate";
import { registerServiceWorker } from "./registerServiceWorker";
import {
  createDepotTenangGame,
  type DepotTenangGame,
} from "./game/depotTenangGameFactory";
import type { DepotTenangFeedback, DepotTenangState } from "./game/depotTenangTypes";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Dunia Zee requires an app mount.");
}

app.innerHTML = `
  <main class="playroom-shell">
    <section class="playroom" data-testid="playroom" aria-labelledby="playroom-title">
      <div class="playroom__header">
        <p class="eyebrow">Dunia Zee</p>
        <h1 id="playroom-title">Playroom</h1>
        <p class="playroom__intro">Pilih satu Game untuk menemani Explorer menjelajah.</p>
        <div class="service-worker-error" data-testid="service-worker-error" role="alert" hidden>
          <p>Offline support sedang tidak tersedia. Companion tetap bisa bermain online.</p>
          <button class="secondary-button" data-testid="service-worker-retry" type="button">Coba lagi</button>
        </div>
      </div>
      <article class="game-card" aria-labelledby="depot-title">
        <div class="game-card__art" aria-hidden="true">
          <span class="game-card__sun"></span>
          <span class="game-card__road"></span>
          <span class="game-card__vehicle">🚚</span>
        </div>
        <div class="game-card__body">
          <p class="eyebrow">Game pertama</p>
          <h2 id="depot-title">Depot Tenang</h2>
          <p>Truk, kereta api, dan pesawat datang lalu pulang ke tempatnya.</p>
          <p class="companion-prompt" data-testid="companion-prompt">
            Companion: tunjuk kendaraan yang datang, lalu tirukan suaranya bersama Explorer.
          </p>
          <section class="companion-settings" data-testid="companion-settings" aria-labelledby="settings-title">
            <h3 id="settings-title">Companion settings</h3>
            <p class="settings-storage-error" data-testid="settings-storage-error" role="alert" hidden>
              Pengaturan device tidak bisa disimpan. Companion tetap bisa bermain selama kunjungan ini.
            </p>
            <fieldset>
              <legend>Sound Profile</legend>
              <label>
                <input type="radio" name="sound-profile" value="lembut" />
                Lembut
              </label>
              <label>
                <input type="radio" name="sound-profile" value="normal" />
                Normal
              </label>
              <label>
                <input type="radio" name="sound-profile" value="senyap" />
                Senyap
              </label>
            </fieldset>
            <label class="reduced-motion-option">
              <input type="checkbox" data-testid="reduced-motion-toggle" />
              Reduced Motion
            </label>
          </section>
          <button class="primary-button" data-testid="depot-tenang-card" type="button">
            Mulai Depot Tenang
          </button>
        </div>
      </article>
    </section>

    <section class="child-stage" data-testid="child-stage" aria-labelledby="stage-title" hidden>
      <header class="stage-hud">
        <div>
          <p class="eyebrow">Dunia Zee</p>
          <h1 id="stage-title" data-testid="stage-title">Depot Tenang</h1>
        </div>
        <div class="stage-status" aria-live="polite">
          <span class="active-vehicle" data-testid="active-vehicle">Belum ada kendaraan aktif</span>
          <span class="game-status" data-testid="game-status">Depot sedang dibuka</span>
          <span class="diorama-time" data-testid="diorama-time">Afternoon</span>
          <span class="play-cycle-state" data-testid="play-cycle-state">Exploring</span>
        </div>
      </header>
      <div
        id="game-mount"
        class="game-mount"
        tabindex="0"
        role="application"
        aria-label="Child Stage Depot Tenang. Tekan tombol atau ketuk untuk melihat kendaraan berjalan."
      >
        <div class="game-loading" data-testid="game-loading" role="status" aria-live="polite" hidden>
          <p class="eyebrow">Depot Tenang</p>
          <p>Depot sedang disiapkan untuk bermain.</p>
        </div>
        <div class="game-load-error" data-testid="game-load-error" role="alert" hidden>
          <p class="eyebrow">Depot Tenang</p>
          <h2>Depot belum siap</h2>
          <p>Companion, Depot belum bisa dibuka. Coba lagi atau kembali ke Playroom.</p>
          <div class="game-load-error__actions">
            <button class="primary-button" data-testid="game-load-retry" type="button">Coba lagi</button>
            <button class="secondary-button" data-testid="game-load-return" type="button">Return to Playroom</button>
          </div>
        </div>
      </div>
      <p class="portrait-guidance" data-testid="portrait-guidance" role="status">
        Putar perangkat ke posisi landscape untuk bermain lebih nyaman.
      </p>
      <div class="companion-gate-touch companion-gate-touch--left" data-testid="companion-gate-touch-left" aria-hidden="true"></div>
      <div class="companion-gate-touch companion-gate-touch--right" data-testid="companion-gate-touch-right" aria-hidden="true"></div>
      <section
        class="companion-gate"
        data-testid="companion-gate"
        aria-labelledby="companion-gate-title"
        aria-modal="true"
        role="dialog"
        hidden
      >
        <div class="companion-gate__card">
          <p class="eyebrow">Companion Gate</p>
          <h2 id="companion-gate-title">Playroom?</h2>
          <p>Companion, pilih apakah ingin melanjutkan atau kembali ke Playroom.</p>
          <div class="companion-gate__actions">
            <button class="primary-button" data-testid="companion-gate-continue" type="button">Continue</button>
            <button class="secondary-button" data-testid="companion-gate-return" type="button">Return to Playroom</button>
          </div>
        </div>
      </section>
    </section>
  </main>
`;

const playroom = getRequiredElement<HTMLElement>("[data-testid='playroom']");
const childStage = getRequiredElement<HTMLElement>("[data-testid='child-stage']");
const startButton = getRequiredElement<HTMLButtonElement>("[data-testid='depot-tenang-card']");
const serviceWorkerError = getRequiredElement<HTMLElement>("[data-testid='service-worker-error']");
const serviceWorkerRetry = getRequiredElement<HTMLButtonElement>("[data-testid='service-worker-retry']");
const gameMount = getRequiredElement<HTMLElement>("#game-mount");
const gameLoading = getRequiredElement<HTMLElement>("[data-testid='game-loading']");
const gameLoadError = getRequiredElement<HTMLElement>("[data-testid='game-load-error']");
const gameLoadRetry = getRequiredElement<HTMLButtonElement>("[data-testid='game-load-retry']");
const gameLoadReturn = getRequiredElement<HTMLButtonElement>("[data-testid='game-load-return']");
const gameStatus = getRequiredElement<HTMLElement>("[data-testid='game-status']");
const activeVehicle = getRequiredElement<HTMLElement>("[data-testid='active-vehicle']");
const dioramaTime = getRequiredElement<HTMLElement>("[data-testid='diorama-time']");
const playCycleState = getRequiredElement<HTMLElement>("[data-testid='play-cycle-state']");
const soundProfileInputs = getRequiredElements<HTMLInputElement>("input[name='sound-profile']");
const reducedMotionInput = getRequiredElement<HTMLInputElement>("[data-testid='reduced-motion-toggle']");
const companionGate = getRequiredElement<HTMLElement>("[data-testid='companion-gate']");
const companionGateContinue = getRequiredElement<HTMLButtonElement>("[data-testid='companion-gate-continue']");
const companionGateReturn = getRequiredElement<HTMLButtonElement>("[data-testid='companion-gate-return']");
const companionGateTouchLeft = getRequiredElement<HTMLElement>("[data-testid='companion-gate-touch-left']");
const companionGateTouchRight = getRequiredElement<HTMLElement>("[data-testid='companion-gate-touch-right']");

const settingsStorageError = getRequiredElement<HTMLElement>("[data-testid='settings-storage-error']");

function showSettingsStorageError(): void {
  settingsStorageError.hidden = false;
}

let companionSettings = loadCompanionSettings(undefined, showSettingsStorageError);
applySettingsToPanel(companionSettings);

for (const input of soundProfileInputs) {
  input.addEventListener("change", () => {
    if (!input.checked || !isSoundProfile(input.value)) {
      return;
    }

    companionSettings = {
      ...companionSettings,
      soundProfile: input.value,
    };
    saveCompanionSettings(companionSettings, undefined, showSettingsStorageError);
  });
}

reducedMotionInput.addEventListener("change", () => {
  companionSettings = {
    ...companionSettings,
    reducedMotion: reducedMotionInput.checked,
  };
  saveCompanionSettings(companionSettings, undefined, showSettingsStorageError);
});

let game: DepotTenangGame | undefined;
let isGameLoading = false;
let isGameReady = false;
let gameLoadAttempt = 0;
const pendingKeyboardInputs: string[] = [];
const pendingPointerInputs: Array<{ clientX: number; clientY: number }> = [];
const keyboardCodes: Record<string, number> = {
  ArrowRight: 39,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowDown: 40,
  Space: 32,
  Enter: 13,
};
let serviceWorkerReady = registerServiceWorker();
let audioContext: AudioContext | undefined;
let audioOutput: GainNode | undefined;
let nextActionSoundAt = 0;

installCompanionGate({
  keyboardTarget: window,
  leftTouchCorner: companionGateTouchLeft,
  rightTouchCorner: companionGateTouchRight,
  onOpen: openCompanionGate,
});

void serviceWorkerReady.then(handleServiceWorkerStatus);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (isServiceWorkerErrorMessage(event.data)) {
      showServiceWorkerError();
    }
  });
}

serviceWorkerRetry.addEventListener("click", () => {
  serviceWorkerError.hidden = true;
  serviceWorkerRetry.disabled = true;
  serviceWorkerReady = registerServiceWorker();
  void serviceWorkerReady.then((status) => {
    serviceWorkerRetry.disabled = false;
    handleServiceWorkerStatus(status);
  });
});

window.addEventListener(
  "keydown",
  (event) => {
    if (isGameReady || !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Space", "Enter"].includes(event.key)) {
      return;
    }

    pendingKeyboardInputs.push(event.key);
  },
  true,
);
childStage.addEventListener(
  "pointerdown",
  (event) => {
    if (isGameReady) {
      return;
    }

    pendingPointerInputs.push({
      clientX: event.clientX,
      clientY: event.clientY,
    });
  },
  true,
);

companionGateContinue.addEventListener("click", closeCompanionGate);
companionGateReturn.addEventListener("click", returnToPlayroom);
gameLoadRetry.addEventListener("click", () => {
  void startDepotTenang();
});
gameLoadReturn.addEventListener("click", returnToPlayroom);

startButton.addEventListener("click", () => {
  void startDepotTenang();
});

async function startDepotTenang(): Promise<void> {
  if (game || isGameLoading) {
    return;
  }

  isGameLoading = true;
  isGameReady = false;
  activateAudio(companionSettings.soundProfile);
  childStage.dataset.soundProfile = companionSettings.soundProfile;
  childStage.dataset.reducedMotion = String(companionSettings.reducedMotion);
  startButton.disabled = true;
  playroom.hidden = true;
  childStage.hidden = false;
  childStage.setAttribute("aria-busy", "true");
  gameLoading.hidden = false;
  gameLoadError.hidden = true;
  gameStatus.textContent = "Depot Tenang sedang dimuat";
  updateDioramaTime(0);
  playCycleState.textContent = "Exploring";

  try {
    const serviceWorkerStatus = await serviceWorkerReady;
    handleServiceWorkerStatus(serviceWorkerStatus);
    const gameModule =
      gameLoadAttempt === 0
        ? import("./game/depotTenangGame")
        : import("./game/depotTenangGameRetry");
    gameLoadAttempt += 1;
    const { loadDepotTenangGameDependencies } = await gameModule;
    let resolveGameStageReady: (() => void) | undefined;
    const gameStageReady = new Promise<void>((resolve) => {
      resolveGameStageReady = resolve;
    });
    game = await createDepotTenangGame(
      {
        parent: gameMount,
        onStateChange: (state) => {
          updateStageState(state);
          if (state === "ready") {
            resolveGameStageReady?.();
          }
        },
        onFeedback: updateStageFeedback,
        onActionAccepted: playActionSound,
        onJourneyComplete: updateDioramaTime,
        onPlayCycleComplete: enterQuietState,
        reducedMotion: companionSettings.reducedMotion,
      },
      loadDepotTenangGameDependencies,
    );
    await gameStageReady;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    isGameReady = true;
    replayPendingInputs();
    gameLoading.hidden = true;
    gameLoadError.hidden = true;
  } catch {
    gameLoading.hidden = true;
    gameLoadError.hidden = false;
    gameStatus.textContent = "Depot belum siap. Coba lagi.";
  } finally {
    childStage.setAttribute("aria-busy", "false");
    isGameLoading = false;
  }
}

function replayPendingInputs(): void {
  for (const key of pendingKeyboardInputs.splice(0)) {
    const event = new KeyboardEvent("keydown", { bubbles: true, key });
    Object.defineProperty(event, "keyCode", { value: keyboardCodes[key] });
    Object.defineProperty(event, "which", { value: keyboardCodes[key] });
    window.dispatchEvent(event);
  }

  const canvas = gameMount.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) {
    pendingPointerInputs.length = 0;
    return;
  }

  for (const input of pendingPointerInputs.splice(0)) {
    canvas.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: input.clientX,
        clientY: input.clientY,
      }),
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: input.clientX,
        clientY: input.clientY,
      }),
    );
  }
}

function updateStageState(state: DepotTenangState): void {
  const labels: Record<DepotTenangState, string> = {
    ready: "Truk menunggu di garasi",
    moving: "Truk sedang berjalan",
    cargo: "Truk menurunkan muatan",
    returning: "Truk kembali ke garasi",
    quiet: "Truk tenang di garasi",
    recovering: "Muatan kembali perlahan",
    "train-moving": "Kereta sedang berjalan",
    "train-station": "Kereta di stasiun",
    "train-returning": "Kereta kembali ke depot",
    "train-quiet": "Kereta tenang di depot",
    "train-recovering": "Kereta kembali perlahan",
    "airplane-taking-off": "Pesawat lepas landas",
    "airplane-flying": "Pesawat terbang di koridor aman",
    "airplane-returning": "Pesawat kembali ke hangar",
    "airplane-quiet": "Pesawat tenang di hangar",
    "airplane-recovering": "Pesawat kembali perlahan",
  };

  gameStatus.textContent = labels[state];
  const trainIsActive = state.startsWith("train-") && state !== "train-quiet";
  const airplaneIsActive =
    state === "airplane-taking-off" ||
    state === "airplane-flying" ||
    state === "airplane-returning" ||
    state === "airplane-recovering";
  const vehicleIsResting =
    state === "ready" || state === "quiet" || state === "train-quiet" || state === "airplane-quiet";
  activeVehicle.textContent = airplaneIsActive
    ? "Pesawat aktif"
    : trainIsActive
      ? "Kereta aktif"
      : vehicleIsResting
        ? "Belum ada kendaraan aktif"
        : "Truk aktif";
}

function updateStageFeedback(feedback: DepotTenangFeedback): void {
  const labels: Record<DepotTenangFeedback, string> = {
    "cargo-grabbed": "Muatan bergerak perlahan",
    "cargo-released": "Muatan dilepas dengan lembut",
    "cargo-recovered": "Muatan kembali perlahan",
    "train-grabbed": "Kereta bergerak perlahan",
    "train-released": "Kereta dilepas dengan lembut",
    "train-recovered": "Kereta kembali perlahan",
    "airplane-grabbed": "Pesawat bergerak perlahan",
    "airplane-released": "Pesawat dilepas dengan lembut",
    "airplane-recovered": "Pesawat kembali perlahan",
    "quiet-response": "Depot tetap tenang",
    "vehicle-selected": "Truk menunggu di garasi",
  };
  gameStatus.textContent = labels[feedback];
  if (feedback === "vehicle-selected") {
    activeVehicle.textContent = "Truk aktif";
  }
}

function updateDioramaTime(completedJourneys: number): void {
  const timeOfDay = completedJourneys >= 3 ? "Dusk" : completedJourneys > 0 ? "Late afternoon" : "Afternoon";
  dioramaTime.textContent = timeOfDay;
  childStage.dataset.timeOfDay = timeOfDay.toLowerCase().replace(" ", "-");
}

function enterQuietState(): void {
  playCycleState.textContent = "Quiet State";
  childStage.dataset.quietState = "true";
}

function activateAudio(soundProfile: SoundProfile): void {
  const windowWithWebkitAudio = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor = window.AudioContext ?? windowWithWebkitAudio.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  audioContext = new AudioContextConstructor();
  audioOutput = audioContext.createGain();
  audioOutput.gain.value = getSoundProfileVolume(soundProfile);
  audioOutput.connect(audioContext.destination);
  void audioContext.resume();
}

function playActionSound(): void {
  const output = audioOutput;
  if (!audioContext || !output || audioContext.state === "closed") {
    return;
  }

  const now = audioContext.currentTime;
  if (now < nextActionSoundAt) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(440, now);
  oscillator.frequency.exponentialRampToValueAtTime(330, now + 0.08);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(now);
  oscillator.stop(now + 0.1);
  nextActionSoundAt = now + 0.1;
}

function openCompanionGate(): void {
  if (childStage.hidden) {
    return;
  }

  companionGate.hidden = false;
  companionGateContinue.focus();
}

function closeCompanionGate(): void {
  companionGate.hidden = true;
}

function returnToPlayroom(): void {
  closeCompanionGate();
  game?.destroy(true);
  game = undefined;
  isGameLoading = false;
  isGameReady = false;
  pendingKeyboardInputs.length = 0;
  pendingPointerInputs.length = 0;
  childStage.hidden = true;
  childStage.setAttribute("aria-busy", "false");
  playroom.hidden = false;
  startButton.disabled = false;
  gameLoading.hidden = true;
  gameLoadError.hidden = true;
  gameStatus.textContent = "Depot sedang dibuka";
  activeVehicle.textContent = "Belum ada kendaraan aktif";
  updateDioramaTime(0);
  playCycleState.textContent = "Exploring";
  delete childStage.dataset.quietState;
}

function applySettingsToPanel(settings: CompanionSettings): void {
  for (const input of soundProfileInputs) {
    input.checked = input.value === settings.soundProfile;
  }
  reducedMotionInput.checked = settings.reducedMotion;
}

function getSoundProfileVolume(soundProfile: SoundProfile): number {
  if (soundProfile === "senyap") {
    return 0;
  }

  return soundProfile === "normal" ? 0.8 : 0.45;
}

function getRequiredElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);

  if (!element) {
    throw new Error(`Dunia Zee is missing ${selector}.`);
  }

  return element;
}

function getRequiredElements<ElementType extends Element>(selector: string): ElementType[] {
  const elements = Array.from(document.querySelectorAll<ElementType>(selector));

  if (elements.length === 0) {
    throw new Error(`Dunia Zee is missing ${selector}.`);
  }

  return elements;
}

type ServiceWorkerStatus = Awaited<ReturnType<typeof registerServiceWorker>>;

function handleServiceWorkerStatus(status: ServiceWorkerStatus): void {
  if (!status.supported || !status.error) {
    serviceWorkerError.hidden = true;
    return;
  }

  showServiceWorkerError();
}

function showServiceWorkerError(): void {
  serviceWorkerError.hidden = false;
  serviceWorkerRetry.disabled = false;
}

function isServiceWorkerErrorMessage(value: unknown): value is { type: "dunia-zee-error" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "dunia-zee-error"
  );
}
