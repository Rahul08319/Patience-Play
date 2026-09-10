import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initializePlayables,
  loadGameData,
  notifyFirstFrameReady,
  notifyGameReady,
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
  });

  it("forwards lifecycle, system, save, and score calls in Playables", async () => {
    const firstFrameReady = vi.fn();
    const gameReady = vi.fn();
    const saveData = vi.fn().mockResolvedValue(undefined);
    const sendScore = vi.fn().mockResolvedValue(undefined);
    const onAudioEnabledChange = vi.fn();
    const onPause = vi.fn();
    const onResume = vi.fn();
    window.ytgame = {
      IN_PLAYABLES_ENV: true,
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
      engagement: { sendScore },
    };

    notifyFirstFrameReady();
    notifyGameReady();
    await saveGameData({ version: 1, highScore: 500 });
    await sendBestScore(500);
    const system = await initializePlayables();
    const unsubscribe = subscribeToSystemEvents({ onAudioEnabledChange: vi.fn(), onPause: vi.fn(), onResume: vi.fn() });

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
  });
});
