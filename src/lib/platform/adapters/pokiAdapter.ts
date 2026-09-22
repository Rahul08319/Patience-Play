import { PlatformAdapter } from "../types";

export class PokiAdapter implements PlatformAdapter {
  readonly id = "poki" as const;
  readonly name = "Poki";
  private initialized = false;

  private get poki(): any {
    return typeof window !== "undefined" ? (window as any).PokiSDK : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.poki);
  }

  async init(): Promise<void> {
    if (!this.poki || this.initialized) return;
    try {
      await this.poki.init();
      this.initialized = true;
    } catch {
      // Local or blocked ad environment fallback
    }
  }

  firstFrameReady(): void {}

  gameReady(): void {
    if (this.poki) {
      try {
        this.poki.gameLoadingFinished();
      } catch {}
    }
  }

  async loadData<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem("tapOrWait_pokiSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      localStorage.setItem("tapOrWait_pokiSave", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.poki) return false;
    return new Promise((resolve) => {
      try {
        this.poki.commercialBreak(() => resolve(true));
      } catch {
        resolve(false);
      }
    });
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    if (!this.poki) return false;
    return new Promise((resolve) => {
      try {
        this.poki.rewardedBreak((success: boolean) => resolve(Boolean(success)));
      } catch {
        resolve(false);
      }
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
