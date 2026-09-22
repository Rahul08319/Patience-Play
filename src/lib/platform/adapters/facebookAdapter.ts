import { PlatformAdapter } from "../types";

export class FacebookAdapter implements PlatformAdapter {
  readonly id = "facebook" as const;
  readonly name = "Facebook Instant Games";
  private initialized = false;

  private get fb(): any {
    return typeof window !== "undefined" ? (window as any).FBInstant : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.fb);
  }

  async init(): Promise<void> {
    if (!this.fb || this.initialized) return;
    try {
      await this.fb.initializeAsync();
      await this.fb.startGameAsync();
      this.initialized = true;
    } catch (err) {
      console.warn("[FacebookAdapter] init error:", err);
    }
  }

  firstFrameReady(): void {
    // Handled in startGameAsync for Facebook Instant
  }

  gameReady(): void {
    if (this.fb && !this.initialized) {
      this.fb.startGameAsync().catch(() => {});
    }
  }

  async loadData<T>(): Promise<T | null> {
    if (!this.fb) return null;
    try {
      const data = await this.fb.player.getDataAsync(["saveData"]);
      return (data?.saveData as T) || null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    if (!this.fb) return false;
    try {
      await this.fb.player.setDataAsync({ saveData: data });
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.fb) return false;
    try {
      const ad = await this.fb.getInterstitialAdAsync("YOUR_FB_INTERSTITIAL_PLACEMENT_ID");
      await ad.loadAsync();
      await ad.showAsync();
      return true;
    } catch {
      return false;
    }
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    if (!this.fb) return false;
    try {
      const ad = await this.fb.getRewardedVideoAsync("YOUR_FB_REWARDED_PLACEMENT_ID");
      await ad.loadAsync();
      await ad.showAsync();
      return true;
    } catch {
      return false;
    }
  }

  async submitScore(score: number): Promise<boolean> {
    if (!this.fb) return false;
    try {
      const leaderboard = await this.fb.getLeaderboardAsync("Global_Leaderboard");
      await leaderboard.setScoreAsync(score);
      return true;
    } catch {
      return false;
    }
  }

  getLanguage(): string {
    return this.fb?.getLocale?.() || "en";
  }

  isAudioEnabled(): boolean {
    return true;
  }
}
