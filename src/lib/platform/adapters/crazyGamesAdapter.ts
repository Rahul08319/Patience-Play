import { PlatformAdapter } from "../types";

export class CrazyGamesAdapter implements PlatformAdapter {
  readonly id = "crazygames" as const;
  readonly name = "CrazyGames";
  private initialized = false;

  private get cg(): any {
    return typeof window !== "undefined" ? (window as any).CrazyGames?.SDK : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.cg);
  }

  async init(): Promise<void> {
    if (!this.cg || this.initialized) return;
    try {
      await this.cg.init?.();
      this.initialized = true;
    } catch {}
  }

  firstFrameReady(): void {}

  gameReady(): void {
    if (this.cg) {
      try {
        this.cg.game?.loadingStop?.();
      } catch {}
    }
  }

  async loadData<T>(): Promise<T | null> {
    try {
      if (this.cg?.data?.getItem) {
        const val = await this.cg.data.getItem("saveData");
        return val ? JSON.parse(val) : null;
      }
      const raw = localStorage.getItem("tapOrWait_cgSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      const serialized = JSON.stringify(data);
      if (this.cg?.data?.setItem) {
        await this.cg.data.setItem("saveData", serialized);
      }
      localStorage.setItem("tapOrWait_cgSave", serialized);
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.cg?.ad?.requestAd) return false;
    return new Promise((resolve) => {
      this.cg.ad.requestAd("midgame", {
        adStarted: () => {},
        adFinished: () => resolve(true),
        adError: () => resolve(false),
      });
    });
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    if (!this.cg?.ad?.requestAd) return false;
    return new Promise((resolve) => {
      this.cg.ad.requestAd("rewarded", {
        adStarted: () => {},
        adFinished: () => resolve(true),
        adError: () => resolve(false),
      });
    });
  }

  async submitScore(_score: number): Promise<boolean> {
    return true;
  }

  getLanguage(): string {
    return navigator.language || "en";
  }

  isAudioEnabled(): boolean {
    return true;
  }
}
