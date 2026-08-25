import Phaser from "phaser";
import "./styles.css";
import { DepotTenangScene, type DepotTenangState } from "./game/DepotTenangScene";

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
        aria-label="Child Stage Depot Tenang. Tekan tombol atau ketuk untuk melihat truk berjalan."
      ></div>
    </section>
  </main>
`;

const playroom = getRequiredElement<HTMLElement>("[data-testid='playroom']");
const childStage = getRequiredElement<HTMLElement>("[data-testid='child-stage']");
const startButton = getRequiredElement<HTMLButtonElement>("[data-testid='depot-tenang-card']");
const gameMount = getRequiredElement<HTMLElement>("#game-mount");
const gameStatus = getRequiredElement<HTMLElement>("[data-testid='game-status']");
const activeVehicle = getRequiredElement<HTMLElement>("[data-testid='active-vehicle']");

let game: Phaser.Game | undefined;

startButton.addEventListener("click", () => {
  if (game) {
    return;
  }

  activateAudio();
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
    }),
  });
});

function updateStageState(state: DepotTenangState): void {
  if (state === "ready") {
    gameStatus.textContent = "Truk menunggu di garasi";
    activeVehicle.textContent = "Belum ada kendaraan aktif";
    return;
  }

  activeVehicle.textContent = "Truk aktif";
  gameStatus.textContent = "Truk sedang berjalan";
}

function activateAudio(): void {
  const windowWithWebkitAudio = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor = window.AudioContext ?? windowWithWebkitAudio.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  const audioContext = new AudioContextConstructor();
  void audioContext.resume();
}

function getRequiredElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);

  if (!element) {
    throw new Error(`Dunia Zee is missing ${selector}.`);
  }

  return element;
}
