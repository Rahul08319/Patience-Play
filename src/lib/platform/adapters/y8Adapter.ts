import { PlatformAdapter } from "../types";

export class Y8Adapter implements PlatformAdapter {
  readonly id = "y8" as const;
  readonly name = "Y8 Games";

  private get idNet(): any {
    return typeof window !== "undefined" ? (window as any).ID : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.idNet);
  }

  async init(): Promise<void> {
    if (this.idNet?.init) {
      try {
        this.idNet.init({ appId: "tap_or_wait" });
      } catch {}
    }
  }

  firstFrameReady(): void {}

  gameReady(): void {}

  async loadData<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem("tapOrWait_y8Save");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      localStorage.setItem("tapOrWait_y8Save", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (this.idNet?.ads?.display) {
      try {
        this.idNet.ads.display();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    return false;
  }

  async submitScore(score: number): Promise<boolean> {
    if (this.idNet?.GameScore?.submitForPlayer) {
      try {
        this.idNet.GameScore.submitForPlayer(score);
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
