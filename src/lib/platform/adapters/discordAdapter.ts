import { PlatformAdapter } from "../types";

export class DiscordAdapter implements PlatformAdapter {
  readonly id = "discord" as const;
  readonly name = "Discord Activities";

  private get discord(): any {
    return typeof window !== "undefined" ? (window as any).discordSdk || (window as any).DiscordSDK : undefined;
  }

  isAvailable(): boolean {
    if (this.discord) return true;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.has("frame_id") || params.has("instance_id") || window.location.ancestorOrigins?.[0]?.includes("discord");
    }
    return false;
  }

  async init(): Promise<void> {
    if (this.discord?.ready) {
      try {
        await this.discord.ready();
      } catch {}
    }
  }

  firstFrameReady(): void {}

  gameReady(): void {}

  async loadData<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem("tapOrWait_discordSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      localStorage.setItem("tapOrWait_discordSave", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    return false; // Discord Activities typically do not run video interstitials
  }

  async showRewarded(_rewardId: string): Promise<boolean> {
    return false;
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
