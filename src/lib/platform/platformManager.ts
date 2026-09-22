import { PlatformAdapter, PlatformId, PlatformMetadata } from "./types";
import { YouTubeAdapter } from "./adapters/youtubeAdapter";
import { FacebookAdapter } from "./adapters/facebookAdapter";
import { PokiAdapter } from "./adapters/pokiAdapter";
import { CrazyGamesAdapter } from "./adapters/crazyGamesAdapter";
import { YandexAdapter } from "./adapters/yandexAdapter";
import { GameDistributionAdapter } from "./adapters/gameDistributionAdapter";
import { DiscordAdapter } from "./adapters/discordAdapter";
import { JioGamesAdapter } from "./adapters/jioGamesAdapter";
import { Y8Adapter } from "./adapters/y8Adapter";
import { LaggedAdapter } from "./adapters/laggedAdapter";
import { QuickGamesAdapter } from "./adapters/quickGamesAdapter";
import { WebIframeAdapter } from "./adapters/webIframeAdapter";
import { PwaAdapter } from "./adapters/pwaAdapter";

export const PLATFORM_REGISTRY: Record<PlatformId, PlatformMetadata> = {
  youtube: {
    id: "youtube",
    name: "YouTube Playables",
    shortName: "YouTube",
    icon: "▶️",
    tagline: "Certified Playables SDK v1",
    color: "#ff0000",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  facebook: {
    id: "facebook",
    name: "Facebook Instant Games",
    shortName: "Facebook",
    icon: "📘",
    tagline: "FBInstant v7.1 Bridge",
    color: "#1877f2",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  poki: {
    id: "poki",
    name: "Poki SDK",
    shortName: "Poki",
    icon: "🦊",
    tagline: "Poki Commercial & Rewarded Breaks",
    color: "#00c3ff",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: false,
  },
  crazygames: {
    id: "crazygames",
    name: "CrazyGames SDK",
    shortName: "CrazyGames",
    icon: "🟣",
    tagline: "CrazyGames v3 Midgame & Rewarded",
    color: "#a855f7",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  yandex: {
    id: "yandex",
    name: "Yandex Games",
    shortName: "Yandex",
    icon: "🟡",
    tagline: "YaGames SDK Adv & Player Data",
    color: "#fc3f1d",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  gamedistribution: {
    id: "gamedistribution",
    name: "GameDistribution",
    shortName: "GameDist",
    icon: "🌐",
    tagline: "GD HTML5 Ad Engine",
    color: "#0284c7",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: false,
  },
  discord: {
    id: "discord",
    name: "Discord Activities",
    shortName: "Discord",
    icon: "💬",
    tagline: "Embedded App SDK Protocol",
    color: "#5865f2",
    hasAds: false,
    hasRewarded: false,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  jiogames: {
    id: "jiogames",
    name: "JioGames",
    shortName: "JioGames",
    icon: "🇮🇳",
    tagline: "Jio Games Smart Ad & Score API",
    color: "#0078d4",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  y8: {
    id: "y8",
    name: "Y8 Games",
    shortName: "Y8",
    icon: "🎱",
    tagline: "ID.net High Scores & Ads",
    color: "#e11d48",
    hasAds: true,
    hasRewarded: false,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  lagged: {
    id: "lagged",
    name: "Lagged",
    shortName: "Lagged",
    icon: "⚡",
    tagline: "Lagged API Scores & Rewards",
    color: "#10b981",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  pwa: {
    id: "pwa",
    name: "Microsoft Store / PWA",
    shortName: "MS Store",
    icon: "🪟",
    tagline: "Windows UWP & Web App Manifest",
    color: "#00a4ef",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  quickgames: {
    id: "quickgames",
    name: "Huawei & Xiaomi Quick Games",
    shortName: "QuickGames",
    icon: "📱",
    tagline: "QuickApp (qg) Native Engine",
    color: "#ea580c",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: false,
  },
  msn_reddit: {
    id: "msn_reddit",
    name: "MSN & Reddit Games",
    shortName: "MSN/Reddit",
    icon: "👾",
    tagline: "Sandboxed PostMessage Protocol",
    color: "#ff4500",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
  standalone: {
    id: "standalone",
    name: "Standalone Web",
    shortName: "Web",
    icon: "🍏",
    tagline: "Apple Design System Engine",
    color: "#007aff",
    hasAds: true,
    hasRewarded: true,
    hasCloudSave: true,
    hasLeaderboards: true,
  },
};

export class PlatformManager {
  private static instance: PlatformManager;
  private adapters: Map<PlatformId, PlatformAdapter> = new Map();
  private activeAdapter: PlatformAdapter;
  private overrideId: PlatformId | null = null;

  private constructor() {
    // Register all native adapters
    this.register(new YouTubeAdapter());
    this.register(new FacebookAdapter());
    this.register(new PokiAdapter());
    this.register(new CrazyGamesAdapter());
    this.register(new YandexAdapter());
    this.register(new GameDistributionAdapter());
    this.register(new DiscordAdapter());
    this.register(new JioGamesAdapter());
    this.register(new Y8Adapter());
    this.register(new LaggedAdapter());
    this.register(new QuickGamesAdapter());
    this.register(new WebIframeAdapter());
    this.register(new PwaAdapter());

    // Check for saved manual override
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("tapOrWait_platformOverride") as PlatformId | null;
      if (saved && (saved in PLATFORM_REGISTRY)) {
        this.overrideId = saved;
      }
    }

    this.activeAdapter = this.resolveActiveAdapter();
  }

  public static getInstance(): PlatformManager {
    if (!PlatformManager.instance) {
      PlatformManager.instance = new PlatformManager();
    }
    return PlatformManager.instance;
  }

  private register(adapter: PlatformAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  private resolveActiveAdapter(): PlatformAdapter {
    if (this.overrideId && this.adapters.has(this.overrideId)) {
      return this.adapters.get(this.overrideId)!;
    }

    // Auto-detect available platform runtime
    for (const adapter of this.adapters.values()) {
      if (adapter.id !== "pwa" && adapter.isAvailable()) {
        return adapter;
      }
    }

    // Check PWA / Microsoft Store
    const pwa = this.adapters.get("pwa");
    if (pwa && pwa.isAvailable()) {
      return pwa;
    }

    // Default to YouTube adapter (primary certified environment) or PWA
    return this.adapters.get("youtube") || this.adapters.get("pwa")!;
  }

  public getActivePlatform(): PlatformMetadata {
    return PLATFORM_REGISTRY[this.activeAdapter.id] || PLATFORM_REGISTRY.standalone;
  }

  public getActiveId(): PlatformId {
    return this.activeAdapter.id;
  }

  public setPlatformOverride(id: PlatformId | null): void {
    this.overrideId = id;
    if (typeof localStorage !== "undefined") {
      if (id) {
        localStorage.setItem("tapOrWait_platformOverride", id);
      } else {
        localStorage.removeItem("tapOrWait_platformOverride");
      }
    }
    this.activeAdapter = this.resolveActiveAdapter();
  }

  public getAllPlatforms(): PlatformMetadata[] {
    return Object.values(PLATFORM_REGISTRY);
  }

  // Unified game lifecycle & feature methods
  public async init(): Promise<void> {
    await this.activeAdapter.init();
  }

  public firstFrameReady(): void {
    this.activeAdapter.firstFrameReady();
  }

  public gameReady(): void {
    this.activeAdapter.gameReady();
  }

  public async loadData<T>(): Promise<T | null> {
    return this.activeAdapter.loadData<T>();
  }

  public async saveData<T>(data: T): Promise<boolean> {
    return this.activeAdapter.saveData<T>(data);
  }

  public async showInterstitial(): Promise<boolean> {
    return this.activeAdapter.showInterstitial();
  }

  public async showRewarded(rewardId = "revive-second-chance"): Promise<boolean> {
    return this.activeAdapter.showRewarded(rewardId);
  }

  public async submitScore(score: number): Promise<boolean> {
    return this.activeAdapter.submitScore(score);
  }

  public async openContent(payload: { id: string; type?: string }): Promise<boolean> {
    if (this.activeAdapter.openContent) {
      return this.activeAdapter.openContent(payload);
    }
    return false;
  }

  public getLanguage(): string {
    return this.activeAdapter.getLanguage();
  }

  public isAudioEnabled(): boolean {
    return this.activeAdapter.isAudioEnabled();
  }

  public onAudioChange(callback: (enabled: boolean) => void): () => void {
    if (this.activeAdapter.onAudioChange) {
      return this.activeAdapter.onAudioChange(callback);
    }
    return () => {};
  }

  public onPause(callback: () => void): () => void {
    if (this.activeAdapter.onPause) {
      return this.activeAdapter.onPause(callback);
    }
    return () => {};
  }

  public onResume(callback: () => void): () => void {
    if (this.activeAdapter.onResume) {
      return this.activeAdapter.onResume(callback);
    }
    return () => {};
  }
}

export const platformManager = PlatformManager.getInstance();
