export type SoundProfile = "lembut" | "normal" | "senyap";

export type CompanionSettings = {
  soundProfile: SoundProfile;
  reducedMotion: boolean;
};

export type CompanionSettingsErrorHandler = (error: unknown) => void;

export const COMPANION_SETTINGS_STORAGE_KEY = "dunia-zee-companion-settings";

export const DEFAULT_COMPANION_SETTINGS: CompanionSettings = {
  soundProfile: "lembut",
  reducedMotion: false,
};

const SOUND_PROFILES: readonly SoundProfile[] = ["lembut", "normal", "senyap"];

export function loadCompanionSettings(
  storage?: Storage,
  onError?: CompanionSettingsErrorHandler,
): CompanionSettings {
  try {
    const storageToUse = storage ?? window.localStorage;
    const storedSettings = storageToUse.getItem(COMPANION_SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      return { ...DEFAULT_COMPANION_SETTINGS };
    }

    return parseCompanionSettings(JSON.parse(storedSettings));
  } catch (error) {
    onError?.(error);
    return { ...DEFAULT_COMPANION_SETTINGS };
  }
}

export function saveCompanionSettings(
  settings: CompanionSettings,
  storage?: Storage,
  onError?: CompanionSettingsErrorHandler,
): boolean {
  try {
    const storageToUse = storage ?? window.localStorage;
    storageToUse.setItem(COMPANION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    onError?.(error);
    return false;
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
