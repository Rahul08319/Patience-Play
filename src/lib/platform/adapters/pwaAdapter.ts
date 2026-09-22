import { PlatformAdapter } from "../types";

export class PwaAdapter implements PlatformAdapter {
  readonly id = "pwa" as const;
  readonly name = "Microsoft Store / PWA";

  isAvailable(): boolean {
    if (typeof window === "undefined") return false;
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
    const isWindowsApp = typeof (window as any).Windows !== "undefined";
    return Boolean(isStandalone || isWindowsApp);
  }

  async init(): Promise<void> {}

  firstFrameReady(): void {}

  gameReady(): void {}

  async loadData<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem("tapOrWait_pwaSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      localStorage.setItem("tapOrWait_pwaSave", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    // Non-intrusive simulated ad delay in standalone PWA / Windows Store mode
    await new Promise((r) => setTimeout(r, 800));
    return true;
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    // Simulated rewarded ad completion for local test & standalone PWA
    await new Promise((r) => setTimeout(r, 1200));
    return true;
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
