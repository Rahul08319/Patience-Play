import { describe, it, expect, beforeEach, vi } from "vitest";
import { soundEngine } from "./soundEngine";

describe("soundEngine", () => {
  beforeEach(() => {
    soundEngine.setSoundEnabled(true);
    soundEngine.setMusicEnabled(true);
    soundEngine.setPlatformMuted(false);
    soundEngine.setGamePaused(false);
  });

  it("handles playSound safely without throwing", () => {
    expect(() => {
      soundEngine.playSound("tap");
      soundEngine.playSound("success");
      soundEngine.playSound("fail");
      soundEngine.playSound("combo");
      soundEngine.playSound("powerup");
      soundEngine.playSound("countdown");
      soundEngine.playSound("countdown_go");
    }).not.toThrow();
  });

  it("handles playTheme transitions safely", () => {
    expect(() => {
      soundEngine.playTheme("menu");
      soundEngine.playTheme("gameplay");
      soundEngine.playTheme("gameover");
      soundEngine.playTheme("silent");
    }).not.toThrow();
  });

  it("respects sound and music toggle states", () => {
    soundEngine.setSoundEnabled(false);
    soundEngine.setMusicEnabled(false);
    expect(() => {
      soundEngine.playSound("tap");
      soundEngine.playTheme("gameplay");
    }).not.toThrow();
  });

  it("handles platform mute and pause lifecycle events", () => {
    expect(() => {
      soundEngine.setPlatformMuted(true);
      soundEngine.setGamePaused(true);
      soundEngine.setPlatformMuted(false);
      soundEngine.setGamePaused(false);
    }).not.toThrow();
  });
});
