import { PlatformAdapter } from "../types";

export class WebIframeAdapter implements PlatformAdapter {
  readonly id = "msn_reddit" as const;
  readonly name = "MSN & Reddit Games";

  isAvailable(): boolean {
    if (typeof window === "undefined") return false;
    const isIframe = window.self !== window.top;
    const hostname = window.location.hostname;
    return isIframe && (hostname.includes("msn.com") || hostname.includes("reddit.com") || window.location.search.includes("embed=msn") || window.location.search.includes("embed=reddit"));
  }

  async init(): Promise<void> {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage({ type: "GAME_INIT", game: "patience-play" }, "*");
    }
  }

  firstFrameReady(): void {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage({ type: "FIRST_FRAME_READY", game: "patience-play" }, "*");
    }
  }

  gameReady(): void {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage({ type: "GAME_READY", game: "patience-play" }, "*");
    }
  }

  async loadData<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem("tapOrWait_iframeSave");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData<T>(data: T): Promise<boolean> {
    try {
      localStorage.setItem("tapOrWait_iframeSave", JSON.stringify(data));
      if (typeof window !== "undefined" && window.parent) {
        window.parent.postMessage({ type: "SAVE_DATA", data }, "*");
      }
      return true;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage({ type: "REQUEST_INTERSTITIAL", game: "patience-play" }, "*");
      return true;
    }
    return false;
  }

  async showRewarded(rewardId: string): Promise<boolean> {
    if (typeof window === "undefined" || !window.parent) return false;
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "REWARDED_AD_RESULT") {
          window.removeEventListener("message", handler);
          resolve(Boolean(event.data?.rewardEarned));
        }
      };
      window.addEventListener("message", handler);
      window.parent.postMessage({ type: "REQUEST_REWARDED", rewardId, game: "patience-play" }, "*");
      // Safety timeout after 10 seconds if parent host doesn't reply
      setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(false);
      }, 10000);
    });
  }

  async submitScore(score: number): Promise<boolean> {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage({ type: "SUBMIT_SCORE", score, game: "patience-play" }, "*");
      return true;
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
