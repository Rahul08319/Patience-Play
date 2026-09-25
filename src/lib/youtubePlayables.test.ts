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

});
