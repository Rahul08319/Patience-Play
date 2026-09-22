import { PlatformAdapter } from "../types";

export class GameDistributionAdapter implements PlatformAdapter {
  readonly id = "gamedistribution" as const;
  readonly name = "GameDistribution";

  private get gdsdk(): any {
    return typeof window !== "undefined" ? (window as any).gdsdk : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.gdsdk);
  }

  async init(): Promise<void> {}

  firstFrameReady(): void {}

  gameReady(): void {}

  async loadData<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem("tapOrWait_gdSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      localStorage.setItem("tapOrWait_gdSave", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.gdsdk?.showAd) return false;
    try {
      await this.gdsdk.showAd();
      return true;
    } catch {
      return false;
    }
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    if (!this.gdsdk?.showAd) return false;
    try {
      await this.gdsdk.showAd("rewarded");
      return true;
    } catch {
      return false;
    }
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
