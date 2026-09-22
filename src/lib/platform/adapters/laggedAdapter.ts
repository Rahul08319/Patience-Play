import { PlatformAdapter } from "../types";

export class LaggedAdapter implements PlatformAdapter {
  readonly id = "lagged" as const;
  readonly name = "Lagged";

  private get lagged(): any {
    return typeof window !== "undefined" ? (window as any).LaggedAPI : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.lagged);
  }

  async init(): Promise<void> {
    if (this.lagged?.init) {
      try {
        this.lagged.init("tap_or_wait", "dev_123");
      } catch {}
    }
  }

  firstFrameReady(): void {}

  gameReady(): void {}

  async loadData<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem("tapOrWait_laggedSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      localStorage.setItem("tapOrWait_laggedSave", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (this.lagged?.showAd) {
      return new Promise((resolve) => {
        try {
          this.lagged.showAd({
            onSuccess: () => resolve(true),
            onError: () => resolve(false),
          });
        } catch {
          resolve(false);
        }
      });
    }
    return false;
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    if (this.lagged?.showRewardAd) {
      return new Promise((resolve) => {
        try {
          this.lagged.showRewardAd({
            onSuccess: () => resolve(true),
            onError: () => resolve(false),
          });
        } catch {
          resolve(false);
        }
      });
    }
    return false;
  }

  async submitScore(score: number): Promise<boolean> {
    if (this.lagged?.Scores?.save) {
      try {
        this.lagged.Scores.save({ score, board: "high_scores" });
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
