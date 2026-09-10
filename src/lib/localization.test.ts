import { describe, expect, it } from "vitest";
import { getCopy, getPrompts, getTutorialSteps, languageFromLocale } from "./localization";

describe("localization", () => {
  it("uses the YouTube locale's supported base language and falls back to English", () => {
    expect(languageFromLocale("es-419")).toBe("es");
    expect(languageFromLocale("hi-IN")).toBe("hi");
    expect(languageFromLocale("fr-FR")).toBe("en");
  });

  it("provides localized gameplay and tutorial content", () => {
    expect(getCopy("es-ES").play).toBe("JUGAR");
    expect(getPrompts("hi-IN").tap.length).toBeGreaterThan(0);
    expect(getTutorialSteps("en-US")).toHaveLength(5);
  });
});
