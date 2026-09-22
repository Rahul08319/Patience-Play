export type PlatformId =
  | "youtube"
  | "facebook"
  | "poki"
  | "crazygames"
  | "yandex"
  | "gamedistribution"
  | "discord"
  | "jiogames"
  | "y8"
  | "lagged"
  | "pwa"
  | "quickgames"
  | "msn_reddit"
  | "standalone";

export interface PlatformMetadata {
  id: PlatformId;
  name: string;
  shortName: string;
  icon: string;
  tagline: string;
  color: string;
  hasAds: boolean;
  hasRewarded: boolean;
  hasCloudSave: boolean;
  hasLeaderboards: boolean;
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly name: string;
  isAvailable(): boolean;
  init(): Promise<void>;
  firstFrameReady(): void;
  gameReady(): void;
  loadData<T>(): Promise<T | null>;
  saveData<T>(data: T): Promise<boolean>;
  showInterstitial(): Promise<boolean>;
  showRewarded(rewardId: string): Promise<boolean>;
  submitScore(score: number): Promise<boolean>;
  openContent?(payload: { id: string; type?: string }): Promise<boolean>;
  getLanguage(): string;
  isAudioEnabled(): boolean;
  onAudioChange?(callback: (enabled: boolean) => void): () => void;
  onPause?(callback: () => void): () => void;
  onResume?(callback: () => void): () => void;
}
