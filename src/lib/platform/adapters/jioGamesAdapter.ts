import { PlatformAdapter } from "../types";

export class JioGamesAdapter implements PlatformAdapter {
  readonly id = "jiogames" as const;
  readonly name = "JioGames";

  private get jio(): any {
    return typeof window !== "undefined" ? (window as any).JioGames : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.jio);
  }

  async init(): Promise<void> {
    if (this.jio?.init) {
      try {
        await this.jio.init();
      } catch {}
    }
  }

  firstFrameReady(): void {}

  gameReady(): void {}

  async loadData<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem("tapOrWait_jioSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      localStorage.setItem("tapOrWait_jioSave", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (this.jio?.showAd) {
      try {
        await this.jio.showAd();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    if (this.jio?.showRewardedAd) {
      try {
        await this.jio.showRewardedAd();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async submitScore(score: number): Promise<boolean> {
    if (this.jio?.postScore) {
      try {
        this.jio.postScore(score);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  getLanguage(): string {
    return navigator.language || "en";
  }

  isAudioEnabled(): boolean {
    return true;
  }
}
