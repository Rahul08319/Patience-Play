import { PlatformAdapter } from "../types";

export class QuickGamesAdapter implements PlatformAdapter {
  readonly id = "quickgames" as const;
  readonly name = "Huawei & Xiaomi Quick Games";

  private get qg(): any {
    return typeof window !== "undefined" ? (window as any).qg : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.qg);
  }

  async init(): Promise<void> {}

  firstFrameReady(): void {}

  gameReady(): void {}

  async loadData<T>(): Promise<T | null> {
    if (this.qg?.getStorageSync) {
      try {
        const val = this.qg.getStorageSync({ key: "saveData" });
        return val ? JSON.parse(val) : null;
      } catch {}
    }
    try {
      const raw = localStorage.getItem("tapOrWait_qgSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    const serialized = JSON.stringify(data);
    if (this.qg?.setStorageSync) {
      try {
        this.qg.setStorageSync({ key: "saveData", data: serialized });
        return true;
      } catch {}
    }
    try {
      localStorage.setItem("tapOrWait_qgSave", serialized);
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.qg?.createInterstitialAd) return false;
    try {
      const ad = this.qg.createInterstitialAd({ adUnitId: "qg_interstitial_1" });
      await ad.load();
      await ad.show();
      return true;
    } catch {
      return false;
    }
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    if (!this.qg?.createRewardedVideoAd) return false;
    try {
      const ad = this.qg.createRewardedVideoAd({ adUnitId: "qg_rewarded_1" });
      await ad.load();
      await ad.show();
      return true;
    } catch {
      return false;
    }
  }

  async submitScore(_score: number): Promise<boolean> {
    return true;
  }

  getLanguage(): string {
    if (this.qg?.getSystemInfoSync) {
      try {
        return this.qg.getSystemInfoSync()?.language || navigator.language || "en";
      } catch {}
    }
    return navigator.language || "en";
  }

  isAudioEnabled(): boolean {
    return true;
  }
}
