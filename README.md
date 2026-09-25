<div align="center">

# ⚡ Tap or Wait (Patience Play)

> **An ultra-responsive reflex & patience arcade experience with a polished glass-and-aurora visual system.**

[![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![YouTube Playables](https://img.shields.io/badge/YouTube-Playables_Certified-ff0000?style=for-the-badge&logo=youtube&logoColor=white)](https://developers.google.com/youtube/gaming/playables)
[![Apple Design](https://img.shields.io/badge/Apple-Fluid_Design-000000?style=for-the-badge&logo=apple&logoColor=white)](https://developer.apple.com/design/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

<br />

### Playables highlights
- Three game modes: Classic, Endless, and a deterministic Daily Challenge.
- Daily challenges replay the same round, fake-out, and power-up sequence for every player on the same UTC date.
- Local leaderboards with YouTube Playables cloud-save support for player progress.
- English, Spanish, and Hindi gameplay copy selected from the YouTube locale.
- Accessibility options: high contrast, reduced motion, haptic toggle, scanline strength, and distinct audio cues.
- A native WebGL aurora scene with phase-aware color, glass surfaces, and a low-power fallback for compatible mobile devices.
- Touch, mouse, keyboard (`Space`/`Enter`), `Esc` menu dismissal, and `F` fullscreen support.
- No ads, rewarded ads, interstitials, or other monetization integrations.

**[🎮 Live Playable Demo](https://patience-play.vercel.app) • [📖 Playables support](#-youtube-playables-integration) • [🚀 Quickstart](#-quickstart)**

</div>

---

## 🌟 Overview

**Tap or Wait** is an adrenaline-fueled reaction game where quick reflexes alone aren't enough—mastering self-control is key. Tap on cyan prompts, resist on gold alerts, detect deceptive fake-outs, collect tactile power-ups, and survive progressively intense rounds.

Built for the web and YouTube Playables with responsive touch controls, local fallbacks for development, and an ad-free gameplay loop.

---

## 🍎 Apple Design System & Fluid Motion

The game interface implements Apple's human interface guidelines and fluid physics:

- **Liquid Glass Materials**: Translucent panels (`backdrop-filter: blur(32px) saturate(200%)`) with multi-layered specular edge highlights and subtle depth staircasing.
- **Status Pill**: A compact, non-interruptive indicator for the YouTube Playables-ready, ad-free runtime.
- **Apple Bento Grid Layouts**: Clean, modular information tiles for game modes, daily seed challenges, accessibility preferences, and leaderboards.
- **Interruptible Spring Physics**: Natural deceleration and direct-manipulation tactile feedback with press scaling (`active:scale-[0.965]`).
- **OLED Dark Mode & Semantic Palette**: True-black OLED backgrounds accented by Apple System Blue (`#007aff`), Cyan, Electric Magenta, and Warm Amber.

---

## 🕹️ YouTube Playables focus

| Capability | Implementation |
| :--- | :--- |
| Lifecycle | `firstFrameReady()` followed by `gameReady()` once the game is usable |
| Persistence | `loadData()` / `saveData()` with a browser-local fallback for development |
| Device control | SDK audio state plus pause/resume handling |
| Score | Best-score reporting through the Playables engagement API |
| Monetization | Not implemented — no ad or revive requests are made |

---

## 📺 YouTube Playables integration

The repository implements the required runtime hooks; final compatibility validation occurs in the YouTube Playables Developer Portal:

```html
<!-- index.html: Loaded before any game code to ensure reproducible sandboxing -->
<script src="https://www.youtube.com/game_api/v1"></script>
```

### Required Lifecycle
1. **`firstFrameReady()`**: Dispatched immediately upon the initial animation frame render.
2. **`gameReady()`**: Dispatched only once all assets, sound contexts, and local data are initialized and interactive.
3. **`saveData(data)` & `loadData()`**: Validated UTF-16 serialization constrained within the mandatory 3 MiB budget.
4. **`onPause()` & `onResume()`**: Suspends tickers, saves dirty state before memory eviction, and safely restores state.
5. **`isAudioEnabled()` & `onAudioEnabledChange()`**: Dynamically adheres to YouTube master mute preferences.

### Monetization

This project intentionally includes no ads, rewarded revives, interstitials, in-app purchases, or monetization SDK calls.

### Content Security Policy (CSP) Verification Guide
When testing inside Google Chrome DevTools Overrides for Playables certification, enforce the official Playables CSP header:

```http
default-src 'none'; script-src 'report-sample' 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.youtube.com/game_api/v0 https://www.youtube.com/game_api/v0/ https://www.youtube.com/game_api/v1 https://www.youtube.com/game_api/v1/; object-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' blob: data:; sandbox allow-pointer-lock allow-same-origin allow-scripts; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:
```

---

## 🎯 Gameplay & Features

- **3 Distinct Modes**:
  - **Classic Mode**: Escalating rounds with increasing fake-out frequency and tight reaction windows.
  - **Endless Mode**: High-speed survival timer with decay curves and weighted power-up drops.
  - **Daily Signal**: Deterministic seed challenge (`YYYY-MM-DD`) generating the identical round, fake-out, and power-up order for all players worldwide.
- **Power-Up System**:
  - ❄️ **Time Freeze**: Expands reaction window by +50% for 3 rounds.
  - ⚡ **2× Points**: Doubles all tap and combo points for 3 rounds.
  - 💜 **Extra Life**: Shield that automatically absorbs 1 fatal mistake.
- **Accessibility & Preferences**:
  - 📺 **Samsung-Friendly Scanlines**: Continuously adjustable slider (0–100%).
  - ◐ **High Contrast Mode**: Crisp black/white OLED contrast for maximum legibility.
  - ◌ **Reduced Motion**: Disables screen shakes, flashing, and floating particles.
  - ♫ **Distinct Audio Cues**: Accessible auditory feedback for visual impairments.
  - 🌐 **Auto Localization**: Dynamic translation across English, Spanish, and Hindi.

---

## ⌨️ Controls & Keybindings

| Action | Touch / Mouse | Keyboard |
| :--- | :--- | :--- |
| **Tap / React** | Tap anywhere inside the target arena | `Space` / `Enter` |
| **Dismiss Menu / Back** | Tap the Back or Menu button | `Escape` |
| **Toggle Fullscreen** | Fullscreen Icon | `F` |
| **Collect Power-Up** | Direct Tap on floating icon | Mouse Click |

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+ or Bun
- npm, pnpm, or bun

### 1. Clone & Install
```bash
git clone https://github.com/Rahul08319/patience-play.git
cd patience-play
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open the local URL displayed by Vite (e.g. `http://localhost:5173`).

### 3. Run Automated Tests
```bash
npm test
```
Runs the Vitest suite covering game logic, cloud saves, and the YouTube Playables lifecycle.

### 4. Build for Production
```bash
npm run build
```
Creates an optimized, tree-shaken static production bundle in `dist/`.

---

## 📂 Project Architecture

```text
patience-play/
├── src/
│   ├── components/
│   │   ├── TapOrWaitGame.tsx    # Gameplay, controls, and accessibility
│   │   └── AuroraBackdrop.tsx   # Dependency-free WebGL aurora renderer
│   ├── lib/
│   │   ├── youtubePlayables.ts  # Safe SDK adapter and cloud persistence
│   │   └── localization.ts      # Translated gameplay copy
│   ├── types/ytgame.d.ts        # Minimal SDK definitions used by the game
│   └── index.css                # Responsive neon/glass design system
├── index.html                   # Earliest SDK insertion point
└── package.json
```

---

## 📜 Design principles

- Full-viewport layout that adapts to portrait, landscape, and extreme Playables aspect ratios.
- Clear, high-contrast prompts and large touch targets.
- A short guided tutorial before the first game.
- A glass-and-depth interface with intentionally restrained motion, inspired by modern native mobile interfaces.
- No in-game external links, sharing prompts, user agreements, or exit controls that could conflict with YouTube UI.

## ✨ Next-release ideas

- A real cross-player daily board backed by a server/database.
- Achievement badges and a weekly quest path.
- More translations, including Arabic and Japanese.
- Color-blind palettes and remappable keyboard controls.

## Credits

Built by Rahul Kumar with React, TypeScript, Vite, WebGL, Tailwind CSS, and the YouTube Playables SDK.
