export type SoundProfile = "lembut" | "normal" | "senyap";

export type CompanionSettings = {
  soundProfile: SoundProfile;
  reducedMotion: boolean;
};

export const COMPANION_SETTINGS_STORAGE_KEY = "dunia-zee-companion-settings";

export const DEFAULT_COMPANION_SETTINGS: CompanionSettings = {
  soundProfile: "lembut",
  reducedMotion: false,
};

const SOUND_PROFILES: readonly SoundProfile[] = ["lembut", "normal", "senyap"];

export function loadCompanionSettings(storage: Storage = window.localStorage): CompanionSettings {
  try {
    const storedSettings = storage.getItem(COMPANION_SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      return { ...DEFAULT_COMPANION_SETTINGS };
    }

    return parseCompanionSettings(JSON.parse(storedSettings));
  } catch {
    return { ...DEFAULT_COMPANION_SETTINGS };
  }
}

export function saveCompanionSettings(
  settings: CompanionSettings,
  storage: Storage = window.localStorage,
): void {
  try {
    storage.setItem(COMPANION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Device-local storage can be unavailable in a restricted browser context.
  }
}

function parseCompanionSettings(value: unknown): CompanionSettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_COMPANION_SETTINGS };
  }

  return {
    soundProfile: isSoundProfile(value.soundProfile)
      ? value.soundProfile
      : DEFAULT_COMPANION_SETTINGS.soundProfile,
    reducedMotion:
      typeof value.reducedMotion === "boolean"
        ? value.reducedMotion
        : DEFAULT_COMPANION_SETTINGS.reducedMotion,
  };
}

export function isSoundProfile(value: unknown): value is SoundProfile {
  return typeof value === "string" && SOUND_PROFILES.includes(value as SoundProfile);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
