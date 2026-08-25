import Phaser from "phaser";
import "./styles.css";
import {
  isSoundProfile,
  loadCompanionSettings,
  saveCompanionSettings,
  type CompanionSettings,
  type SoundProfile,
} from "./companionSettings";
import { installCompanionGate } from "./companionGate";
import {
  DepotTenangScene,
  type DepotTenangFeedback,
  type DepotTenangState,
} from "./game/DepotTenangScene";

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
        </div>
      </header>
      <div
        id="game-mount"
        class="game-mount"
        tabindex="0"
        role="application"
        aria-label="Child Stage Depot Tenang. Tekan tombol atau ketuk untuk melihat kendaraan berjalan."
      ></div>
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
const gameMount = getRequiredElement<HTMLElement>("#game-mount");
const gameStatus = getRequiredElement<HTMLElement>("[data-testid='game-status']");
const activeVehicle = getRequiredElement<HTMLElement>("[data-testid='active-vehicle']");
const soundProfileInputs = getRequiredElements<HTMLInputElement>("input[name='sound-profile']");
const reducedMotionInput = getRequiredElement<HTMLInputElement>("[data-testid='reduced-motion-toggle']");
const companionGate = getRequiredElement<HTMLElement>("[data-testid='companion-gate']");
const companionGateContinue = getRequiredElement<HTMLButtonElement>("[data-testid='companion-gate-continue']");
const companionGateReturn = getRequiredElement<HTMLButtonElement>("[data-testid='companion-gate-return']");
const companionGateTouchLeft = getRequiredElement<HTMLElement>("[data-testid='companion-gate-touch-left']");
const companionGateTouchRight = getRequiredElement<HTMLElement>("[data-testid='companion-gate-touch-right']");

let companionSettings = loadCompanionSettings();
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
    saveCompanionSettings(companionSettings);
  });
}

reducedMotionInput.addEventListener("change", () => {
  companionSettings = {
    ...companionSettings,
    reducedMotion: reducedMotionInput.checked,
  };
  saveCompanionSettings(companionSettings);
});

let game: Phaser.Game | undefined;
let audioContext: AudioContext | undefined;
let audioOutput: GainNode | undefined;
let nextActionSoundAt = 0;

installCompanionGate({
  keyboardTarget: window,
  leftTouchCorner: companionGateTouchLeft,
  rightTouchCorner: companionGateTouchRight,
  onOpen: openCompanionGate,
});

companionGateContinue.addEventListener("click", closeCompanionGate);
companionGateReturn.addEventListener("click", returnToPlayroom);

startButton.addEventListener("click", () => {
  if (game) {
    return;
  }

  activateAudio(companionSettings.soundProfile);
  childStage.dataset.soundProfile = companionSettings.soundProfile;
  childStage.dataset.reducedMotion = String(companionSettings.reducedMotion);
  startButton.disabled = true;
  playroom.hidden = true;
  childStage.hidden = false;
  gameStatus.textContent = "Depot sedang dibuka";

  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
    height: 540,
    parent: gameMount,
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
      onStateChange: updateStageState,
      onFeedback: updateStageFeedback,
      onActionAccepted: playActionSound,
      reducedMotion: companionSettings.reducedMotion,
    }),
  });
});

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
  childStage.hidden = true;
  playroom.hidden = false;
  startButton.disabled = false;
  gameStatus.textContent = "Depot sedang dibuka";
  activeVehicle.textContent = "Belum ada kendaraan aktif";
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
