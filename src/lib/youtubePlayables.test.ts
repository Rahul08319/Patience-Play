import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSdkVersion,
  initializePlayables,
  isInPlayablesEnvironment,
  loadGameData,
  logHealthError,
  logHealthWarning,
  notifyFirstFrameReady,
  notifyGameReady,
  openYouTubeContent,
  requestInterstitialAd,
  requestRewardedAd,
  saveGameData,
  sendBestScore,
  subscribeToSystemEvents,
} from "./youtubePlayables";

afterEach(() => {
  localStorage.clear();
  delete window.ytgame;
});

describe("YouTube Playables adapter", () => {
  it("keeps saves working locally when the SDK is unavailable", async () => {
    const data = { version: 1 as const, highScore: 200 };
    await saveGameData(data);
    await expect(loadGameData()).resolves.toEqual(data);
    expect(isInPlayablesEnvironment()).toBe(false);
    expect(getSdkVersion()).toBeNull();
  });

  it("handles ads and monetization gracefully when SDK is absent", async () => {
    await expect(requestInterstitialAd()).resolves.toBe(false);
    await expect(requestRewardedAd("second-chance-revive")).resolves.toBe(false);
    await expect(requestRewardedAd("")).resolves.toBe(false);
  });

  it("forwards lifecycle, system, save, and score calls in Playables", async () => {
    const firstFrameReady = vi.fn();
    const gameReady = vi.fn();
    const saveData = vi.fn().mockResolvedValue(undefined);
    const sendScore = vi.fn().mockResolvedValue(undefined);
    const onAudioEnabledChange = vi.fn();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const logError = vi.fn();
    const logWarning = vi.fn();
    const requestInterstitial = vi.fn().mockResolvedValue(undefined);
    const requestRewarded = vi.fn().mockResolvedValue(true);
    const openContent = vi.fn().mockResolvedValue(undefined);

    window.ytgame = {
      IN_PLAYABLES_ENV: true,
      SDK_VERSION: "1.0.0",
      game: {
        firstFrameReady,
        gameReady,
        loadData: vi.fn().mockResolvedValue('{"version":1,"highScore":500}'),
        saveData,
      },
      system: {
        getLanguage: vi.fn().mockResolvedValue("fr-FR"),
        isAudioEnabled: vi.fn().mockReturnValue(false),
        onAudioEnabledChange,
        onPause,
        onResume,
      },
      engagement: {
        sendScore,
        openYTContent: openContent,
      },
      health: {
        logError,
        logWarning,
      },
      ads: {
        requestInterstitialAd: requestInterstitial,
        requestRewardedAd: requestRewarded,
      },
    } as unknown as typeof ytgame;

    expect(isInPlayablesEnvironment()).toBe(true);
    expect(getSdkVersion()).toBe("1.0.0");

    notifyFirstFrameReady();
    notifyGameReady();
    await saveGameData({ version: 1, highScore: 500 });
    await sendBestScore(500);

    const system = await initializePlayables();
    const unsubscribe = subscribeToSystemEvents({
      onAudioEnabledChange: vi.fn(),
      onPause: vi.fn(),
      onResume: vi.fn(),
    });

    expect(firstFrameReady).toHaveBeenCalledOnce();
    expect(gameReady).toHaveBeenCalledOnce();
    expect(saveData).toHaveBeenCalledWith('{"version":1,"highScore":500}');
    expect(sendScore).toHaveBeenCalledWith({ value: 500 });
    expect(system.audioEnabled).toBe(false);
    expect(document.documentElement.lang).toBe("fr-FR");
    expect(onAudioEnabledChange).toHaveBeenCalledOnce();
    expect(onPause).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledOnce();
    unsubscribe();

    // Health logging
    logHealthError();
    logHealthWarning();
    expect(logError).toHaveBeenCalledOnce();
    expect(logWarning).toHaveBeenCalledOnce();

    // Ads and engagement
    const adResult = await requestInterstitialAd();
    expect(adResult).toBe(true);
    expect(requestInterstitial).toHaveBeenCalledOnce();

    const rewardResult = await requestRewardedAd("second-chance-revive");
    expect(rewardResult).toBe(true);
    expect(requestRewarded).toHaveBeenCalledWith("second-chance-revive");

    const contentResult = await openYouTubeContent({ id: "video123", contentType: "VIDEO" });
    expect(contentResult).toBe(true);
    expect(openContent).toHaveBeenCalledWith({ id: "video123", contentType: "VIDEO" });
  });

  it("rejects invalid score submission", async () => {
    const sendScore = vi.fn().mockResolvedValue(undefined);
    window.ytgame = {
      IN_PLAYABLES_ENV: true,
      engagement: { sendScore },
    } as unknown as typeof ytgame;

    await sendBestScore(-10);
    await sendBestScore(Infinity);
    await sendBestScore(NaN);
    expect(sendScore).not.toHaveBeenCalled();
  });

  it("handles rewarded ads with reward not earned and error cases", async () => {
    const requestRewarded = vi.fn().mockResolvedValue(false);
    window.ytgame = {
      IN_PLAYABLES_ENV: true,
      ads: {
        requestInterstitialAd: vi.fn(),
        requestRewardedAd: requestRewarded,
      },
    } as unknown as typeof ytgame;

    const notEarned = await requestRewardedAd("revive-try");
    expect(notEarned).toBe(false);

    // When ad throws error
    requestRewarded.mockRejectedValueOnce(new Error("Network failed"));
    const failedAd = await requestRewardedAd("revive-try");
    expect(failedAd).toBe(false);
  });
});
