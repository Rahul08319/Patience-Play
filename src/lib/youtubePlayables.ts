export interface PlayablesSaveData {
  version: 1;
  settings?: { sound: boolean; haptics: boolean; scanlineIntensity: number; reducedMotion?: boolean; highContrast?: boolean; accessibleCues?: boolean };
  highScore?: number;
  leaderboard?: unknown[];
  endlessLeaderboard?: unknown[];
  dailyLeaderboard?: unknown[];
}

type PlayablesSdk = {
  IN_PLAYABLES_ENV?: boolean;
  game?: {
    firstFrameReady?: () => void;
    gameReady?: () => void;
    loadData?: () => Promise<string>;
    saveData?: (data: string) => Promise<void>;
  };
  system?: {
    getLanguage?: () => Promise<string>;
    isAudioEnabled?: () => boolean;
    onAudioEnabledChange?: (callback: (enabled: boolean) => void) => () => void;
    onPause?: (callback: () => void) => () => void;
    onResume?: (callback: () => void) => () => void;
  };
  engagement?: { sendScore?: (score: { value: number }) => Promise<void> };
  health?: { logError?: () => void; logWarning?: () => void };
};

declare global {
  interface Window {
    ytgame?: PlayablesSdk;
  }
}

const LOCAL_SAVE_KEY = "tapOrWait_playablesSave";

function sdk(): PlayablesSdk | undefined {
  return window.ytgame;
}

export function isInPlayablesEnvironment(): boolean {
  return Boolean(sdk()?.IN_PLAYABLES_ENV);
}

function reportProblem(kind: "error" | "warning") {
  try {
    sdk()?.health?.[kind === "error" ? "logError" : "logWarning"]?.();
  } catch {
    // Health reporting is intentionally best-effort.
  }
}

function isValidSave(value: string): boolean {
  const stringWithWellFormed = value as string & { isWellFormed?: () => boolean };
  return value.length <= 3 * 1024 * 1024
    && (typeof stringWithWellFormed.isWellFormed !== "function" || stringWithWellFormed.isWellFormed());
}

export function notifyFirstFrameReady() {
  try {
    sdk()?.game?.firstFrameReady?.();
  } catch {
    reportProblem("error");
  }
}

export function notifyGameReady() {
  try {
    sdk()?.game?.gameReady?.();
  } catch {
    reportProblem("error");
  }
}

export async function loadGameData(): Promise<PlayablesSaveData | null> {
  try {
    const raw = isInPlayablesEnvironment()
      ? await sdk()?.game?.loadData?.()
      : localStorage.getItem(LOCAL_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayablesSaveData;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    reportProblem("warning");
    return null;
  }
}

export async function saveGameData(data: PlayablesSaveData) {
  const serialized = JSON.stringify(data);
  if (!isValidSave(serialized)) {
    reportProblem("error");
    return;
  }

  try {
    if (isInPlayablesEnvironment()) {
      await sdk()?.game?.saveData?.(serialized);
    } else {
      localStorage.setItem(LOCAL_SAVE_KEY, serialized);
    }
  } catch {
    reportProblem("warning");
  }
}

export async function initializePlayables(): Promise<{ audioEnabled: boolean; language: string }> {
  const api = sdk();
  if (!api) return { audioEnabled: true, language: navigator.language || "en" };

  let language = navigator.language || "en";
  try {
    const sdkLanguage = await api.system?.getLanguage?.();
    if (sdkLanguage) language = sdkLanguage;
    document.documentElement.lang = language;
  } catch {
    reportProblem("warning");
  }

  try {
    return { audioEnabled: api.system?.isAudioEnabled?.() ?? true, language };
  } catch {
    reportProblem("warning");
    return { audioEnabled: true, language };
  }
}

export function subscribeToSystemEvents(events: {
  onAudioEnabledChange: (enabled: boolean) => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const api = sdk()?.system;
  const unsubscribers: (() => void)[] = [];
  const addUnsubscriber = (value: unknown) => {
    if (typeof value === "function") unsubscribers.push(value as () => void);
  };
  try { if (api?.onAudioEnabledChange) addUnsubscriber(api.onAudioEnabledChange(events.onAudioEnabledChange)); } catch { reportProblem("warning"); }
  try { if (api?.onPause) addUnsubscriber(api.onPause(events.onPause)); } catch { reportProblem("warning"); }
  try { if (api?.onResume) addUnsubscriber(api.onResume(events.onResume)); } catch { reportProblem("warning"); }
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function sendBestScore(value: number) {
  if (!isInPlayablesEnvironment() || !Number.isSafeInteger(value) || value < 0) return;
  try {
    await sdk()?.engagement?.sendScore?.({ value });
  } catch {
    reportProblem("warning");
  }
}
