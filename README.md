# Tap or Wait

> A neon reflex game where the quickest move is sometimes doing nothing.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white) ![YouTube Playables](https://img.shields.io/badge/YouTube-Playables-ff0000?logo=youtube&logoColor=white)

**Tap or Wait** is a touch-first reaction game designed for phones, desktops, and the YouTube Playables canvas. Tap cyan rounds, resist gold rounds, spot fake-outs, build combos, and choose the difficulty that matches your nerve.

## Highlights

- Three game modes: Classic, Endless, and a deterministic Daily Challenge.
- Daily challenges replay the same round, fake-out, and power-up sequence for every player on the same UTC date.
- Local leaderboards with YouTube Playables cloud-save support for player progress.
- English, Spanish, and Hindi gameplay copy selected from the YouTube locale.
- Accessibility options: high contrast, reduced motion, haptic toggle, scanline strength, and distinct audio cues.
- Touch, mouse, keyboard (`Space`/`Enter`), `Esc` menu dismissal, and `F` fullscreen support.
- No ads, rewarded ads, interstitials, or other monetization integrations.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Build and test with:

```bash
npm test
npm run build
```

## YouTube Playables integration

The SDK script is loaded ahead of the app bundle in `index.html`. The integration layer in `src/lib/youtubePlayables.ts` handles:

- `firstFrameReady()` followed by `gameReady()` only after the game is interactable.
- `loadData()` and `saveData()` with a browser-local fallback during development.
- YouTube-controlled audio state and audio-change events.
- SDK pause/resume callbacks and a pause-safe game timer.
- YouTube locale lookup, health logging, and score reporting.

The game intentionally contains **no** `ytgame.ads` calls.

### Playables test-suite checklist

1. Create/upload a release in the [YouTube Playables Developer Portal](https://www.youtube.com/playables_portal).
2. Open the portal-provided **Test Suite Link** and point it to the uploaded release or your local server.
3. Verify SDK loading, ready notifications, cloud save, audio controls, pause/resume, and score submission.
4. Test touch and mouse controls at 9:32, 9:21, 9:16, 3:4, 1:1, 4:3, 16:9, and ultrawide aspect ratios.
5. Test desktop web plus YouTube mobile web, Android, and iOS using the portal-provided Dev Link.

The repository can validate its build and unit tests locally; final certification runs only in the YouTube Playables Developer Portal with an onboarded channel.

## Project structure

```text
src/
  components/TapOrWaitGame.tsx  # Gameplay, UI, controls, accessibility
  lib/youtubePlayables.ts       # Safe SDK adapter and cloud persistence
  lib/localization.ts           # Locale selection and translated copy
  index.css                     # Responsive neon design system
```

## Design principles

- Full-viewport layout that adapts to portrait, landscape, and extreme Playables aspect ratios.
- Clear, high-contrast prompts and large touch targets.
- A short guided tutorial before the first game.
- No in-game external links, sharing prompts, user agreements, or exit controls that could conflict with YouTube UI.

## Ideas for the next release

- A real cross-player daily board backed by a server/database.
- Achievement badges and a weekly quest path.
- More translations, including Arabic and Japanese.
- Color-blind palettes and remappable keyboard controls.

## Credits

Built by Rahul Kumar with React, TypeScript, Vite, Tailwind CSS, and the YouTube Playables SDK.
