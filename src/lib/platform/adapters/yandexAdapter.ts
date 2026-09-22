import { PlatformAdapter } from "../types";

export class YandexAdapter implements PlatformAdapter {
  readonly id = "yandex" as const;
  readonly name = "Yandex Games";
  private ysdk: any = null;

  private get yaGames(): any {
    return typeof window !== "undefined" ? (window as any).YaGames : undefined;
  }

  isAvailable(): boolean {
    return Boolean(this.yaGames);
  }

  async init(): Promise<void> {
    if (!this.yaGames || this.ysdk) return;
    try {
      this.ysdk = await this.yaGames.init();
    } catch {}
  }

  firstFrameReady(): void {}

  gameReady(): void {
    if (this.ysdk?.features?.LoadingAPI?.ready) {
      try {
        this.ysdk.features.LoadingAPI.ready();
      } catch {}
    }
  }

  async loadData<T>(): Promise<T | null> {
    if (!this.ysdk) {
      try {
        const raw = localStorage.getItem("tapOrWait_yandexSave");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
    try {
      const player = await this.ysdk.getPlayer({ scopes: false });
      const data = await player.getData();
      return (data?.saveData as T) || null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    if (!this.ysdk) {
      try {
        localStorage.setItem("tapOrWait_yandexSave", JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    }
    try {
      const player = await this.ysdk.getPlayer({ scopes: false });
      await player.setData({ saveData: data }, true);
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.ysdk?.adv?.showFullscreenAdv) return false;
    return new Promise((resolve) => {
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: () => resolve(true),
          onError: () => resolve(false),
        },
      });
    });
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    if (!this.ysdk?.adv?.showRewardedVideo) return false;
    return new Promise((resolve) => {
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => resolve(true),
          onClose: () => resolve(false),
          onError: () => resolve(false),
        },
      });
    });
  }

  async submitScore(score: number): Promise<boolean> {
    if (!this.ysdk?.getLeaderboards) return false;
    try {
      const lb = await this.ysdk.getLeaderboards();
      await lb.setLeaderboardScore("tap_or_wait_scores", score);
      return true;
    } catch {
      return false;
    }
  }

  getLanguage(): string {
    return this.ysdk?.environment?.i18n?.lang || navigator.language || "en";
  }

  isAudioEnabled(): boolean {
    return true;
  }
}
