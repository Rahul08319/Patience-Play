import { beforeEach, describe, expect, it, vi } from "vitest";
import { platformManager, PLATFORM_REGISTRY } from "./platformManager";
import { PlatformId } from "./types";

describe("PlatformManager Universal Multi-Platform Engine", () => {
  beforeEach(() => {
    localStorage.clear();
    platformManager.setPlatformOverride(null);
  });

  it("contains all 13 required platform definitions plus standalone web", () => {
    const allPlatforms = platformManager.getAllPlatforms();
    const ids = allPlatforms.map((p) => p.id);

    expect(ids).toContain("youtube");
    expect(ids).toContain("facebook");
    expect(ids).toContain("poki");
    expect(ids).toContain("crazygames");
    expect(ids).toContain("yandex");
    expect(ids).toContain("gamedistribution");
    expect(ids).toContain("discord");
    expect(ids).toContain("jiogames");
    expect(ids).toContain("y8");
    expect(ids).toContain("lagged");
    expect(ids).toContain("pwa");
    expect(ids).toContain("quickgames");
    expect(ids).toContain("msn_reddit");
    expect(ids).toContain("standalone");

    expect(allPlatforms.length).toBeGreaterThanOrEqual(14);
  });

  it("switches platforms seamlessly via manual override", () => {
    platformManager.setPlatformOverride("crazygames");
    expect(platformManager.getActiveId()).toBe("crazygames");
    expect(platformManager.getActivePlatform().name).toBe("CrazyGames SDK");

    platformManager.setPlatformOverride("poki");
    expect(platformManager.getActiveId()).toBe("poki");
    expect(platformManager.getActivePlatform().name).toBe("Poki SDK");

    platformManager.setPlatformOverride("facebook");
    expect(platformManager.getActiveId()).toBe("facebook");
    expect(platformManager.getActivePlatform().name).toBe("Facebook Instant Games");

    platformManager.setPlatformOverride("youtube");
    expect(platformManager.getActiveId()).toBe("youtube");
  });

  it("handles storage operations across platforms safely", async () => {
    platformManager.setPlatformOverride("pwa");
    const testData = { version: 1, highScore: 1500 };
    await platformManager.saveData(testData);

    const loaded = await platformManager.loadData<typeof testData>();
    expect(loaded).toEqual(testData);
  });

  it("handles ads and monetization gracefully across all platforms", async () => {
    const platforms: PlatformId[] = [
      "youtube",
      "poki",
      "crazygames",
      "facebook",
      "yandex",
      "gamedistribution",
      "pwa",
    ];

    for (const p of platforms) {
      platformManager.setPlatformOverride(p);
      const interstitial = await platformManager.showInterstitial();
      expect(typeof interstitial).toBe("boolean");

      const rewarded = await platformManager.showRewarded("revive-second-chance");
      expect(typeof rewarded).toBe("boolean");
    }
  });

  it("dispatches gameReady and firstFrameReady without throwing", () => {
    platformManager.setPlatformOverride("youtube");
    expect(() => platformManager.firstFrameReady()).not.toThrow();
    expect(() => platformManager.gameReady()).not.toThrow();
  });
});
