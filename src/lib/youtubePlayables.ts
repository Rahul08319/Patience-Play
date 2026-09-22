export interface PlayablesSaveData {
  version: 1;
  settings?: {
    sound: boolean;
    haptics: boolean;
    scanlineIntensity: number;
    reducedMotion?: boolean;
    highContrast?: boolean;
    accessibleCues?: boolean;
  };
  highScore?: number;
  leaderboard?: unknown[];
  endlessLeaderboard?: unknown[];
  dailyLeaderboard?: unknown[];
}

const LOCAL_SAVE_KEY = "tapOrWait_playablesSave";

function sdk() {
  return typeof window !== "undefined" ? window.ytgame : undefined;
}

export function isInPlayablesEnvironment(): boolean {
  return Boolean(sdk()?.IN_PLAYABLES_ENV);
}

export function getSdkVersion(): string | null {
  return sdk()?.SDK_VERSION ?? null;
}

export function logHealthError() {
  try {
    sdk()?.health?.logError?.();
  } catch {
    // Health reporting is intentionally best-effort.
  }
}

export function logHealthWarning() {
  try {
    sdk()?.health?.logWarning?.();
  } catch {
    // Health reporting is intentionally best-effort.
  }
}

function isValidSave(value: string): boolean {
  const stringWithWellFormed = value as string & { isWellFormed?: () => boolean };
  return (
    value.length <= 3 * 1024 * 1024 &&
    (typeof stringWithWellFormed.isWellFormed !== "function" || stringWithWellFormed.isWellFormed())
  );
}

export function notifyFirstFrameReady() {
  try {
    sdk()?.game?.firstFrameReady?.();
  } catch {
    logHealthError();
  }
}

export function notifyGameReady() {
  try {
    sdk()?.game?.gameReady?.();
  } catch {
    logHealthError();
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
    logHealthWarning();
    return null;
  }
}

export async function saveGameData(data: PlayablesSaveData): Promise<boolean> {
  const serialized = JSON.stringify(data);
  if (!isValidSave(serialized)) {
    logHealthError();
    return false;
  }

  try {
    if (isInPlayablesEnvironment()) {
      await sdk()?.game?.saveData?.(serialized);
    } else {
      localStorage.setItem(LOCAL_SAVE_KEY, serialized);
    }
    return true;
  } catch {
    logHealthWarning();
    return false;
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
    logHealthWarning();
  }

  try {
    return { audioEnabled: api.system?.isAudioEnabled?.() ?? true, language };
  } catch {
    logHealthWarning();
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
  try {
    if (api?.onAudioEnabledChange) addUnsubscriber(api.onAudioEnabledChange(events.onAudioEnabledChange));
  } catch {
    logHealthWarning();
  }
  try {
    if (api?.onPause) addUnsubscriber(api.onPause(events.onPause));
  } catch {
    logHealthWarning();
  }
  try {
    if (api?.onResume) addUnsubscriber(api.onResume(events.onResume));
  } catch {
    logHealthWarning();
  }
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function sendBestScore(value: number): Promise<boolean> {
  if (!isInPlayablesEnvironment() || !Number.isSafeInteger(value) || value < 0) return false;
  try {
    await sdk()?.engagement?.sendScore?.({ value });
    return true;
  } catch {
    logHealthWarning();
    return false;
  }
}

export async function requestInterstitialAd(): Promise<boolean> {
  const api = sdk();
  if (!api?.ads?.requestInterstitialAd) return false;
  try {
    await api.ads.requestInterstitialAd();
    return true;
  } catch {
    logHealthWarning();
    return false;
  }
}

export async function requestRewardedAd(rewardId: string): Promise<boolean> {
  if (!rewardId || typeof rewardId !== "string" || rewardId.trim().length === 0) {
    logHealthError();
    return false;
  }
  const api = sdk();
  if (!api?.ads?.requestRewardedAd) return false;
  try {
    const earned = await api.ads.requestRewardedAd(rewardId);
    return Boolean(earned);
  } catch {
    logHealthWarning();
    return false;
  }
}

export async function openYouTubeContent(content: {
  id: string;
  contentType?: "PLAYABLE" | "VIDEO";
}): Promise<boolean> {
  if (!content?.id) {
    logHealthError();
    return false;
  }
  const api = sdk();
  if (!api?.engagement?.openYTContent) return false;
  try {
    await api.engagement.openYTContent({
      id: content.id,
      contentType: content.contentType as any,
    });
    return true;
  } catch {
    logHealthWarning();
    return false;
  }
}
