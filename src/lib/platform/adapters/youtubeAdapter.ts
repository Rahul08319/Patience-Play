import {
  initializePlayables,
  isInPlayablesEnvironment,
  loadGameData,
  logHealthError,
  logHealthWarning,
  notifyFirstFrameReady,
  notifyGameReady,
  openYouTubeContent,
  requestInterstitialAd,
  requestRewardedAd,
  saveGameData,
  sendBestScore,
  subscribeToSystemEvents,
} from "../../youtubePlayables";
import { PlatformAdapter } from "../types";

export class YouTubeAdapter implements PlatformAdapter {
  readonly id = "youtube" as const;
  readonly name = "YouTube Playables";
  private currentLanguage = "en";
  private audioEnabled = true;

  isAvailable(): boolean {
    return isInPlayablesEnvironment() || typeof window !== "undefined" && Boolean(window.ytgame);
  }

  async init(): Promise<void> {
    const sys = await initializePlayables();
    this.audioEnabled = sys.audioEnabled;
    this.currentLanguage = sys.language;
  }

  firstFrameReady(): void {
    notifyFirstFrameReady();
  }

  gameReady(): void {
    notifyGameReady();
  }

  async loadData<T>(): Promise<T | null> {
    const data = await loadGameData();
    return data as T | null;
  }

  async saveData<T>(data: T): Promise<boolean> {
    return saveGameData(data as any);
  }

  async showInterstitial(): Promise<boolean> {
    return requestInterstitialAd();
  }

  async showRewarded(rewardId: string): Promise<boolean> {
    return requestRewardedAd(rewardId);
  }

  async submitScore(score: number): Promise<boolean> {
    return sendBestScore(score);
  }

  async openContent(payload: { id: string; type?: string }): Promise<boolean> {
    return openYouTubeContent({
      id: payload.id,
      contentType: (payload.type as any) || "VIDEO",
    });
  }

  getLanguage(): string {
    return this.currentLanguage;
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  onAudioChange(callback: (enabled: boolean) => void): () => void {
    return subscribeToSystemEvents({
      onAudioEnabledChange: (enabled) => {
        this.audioEnabled = enabled;
        callback(enabled);
      },
      onPause: () => {},
      onResume: () => {},
    });
  }

  onPause(callback: () => void): () => void {
    return subscribeToSystemEvents({
      onAudioEnabledChange: () => {},
      onPause: callback,
      onResume: () => {},
    });
  }

  onResume(callback: () => void): () => void {
    return subscribeToSystemEvents({
      onAudioEnabledChange: () => {},
      onPause: () => {},
      onResume: callback,
    });
  }
}
