<div align="center">

# ⚡ Tap or Wait (Patience Play)

> **The ultra-responsive reflex & patience arcade experience crafted with Apple Fluid Design and a Universal Multi-Platform Engine.**

[![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![YouTube Playables](https://img.shields.io/badge/YouTube-Playables_Certified-ff0000?style=for-the-badge&logo=youtube&logoColor=white)](https://developers.google.com/youtube/gaming/playables)
[![Apple Design](https://img.shields.io/badge/Apple-Fluid_Design-000000?style=for-the-badge&logo=apple&logoColor=white)](https://developer.apple.com/design/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

<br />

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │  ▶️ YOUTUBE PLAYABLES  •  📘 FB INSTANT  •  🦊 POKI  •  🟣 CRAZYGAMES  │
   │  🟡 YANDEX GAMES  •  🌐 GAMEDISTRIBUTION  •  💬 DISCORD ACTIVITIES     │
   │  🇮🇳 JIOGAMES  •  🎱 Y8  •  ⚡ LAGGED  •  🪟 MICROSOFT STORE (PWA)     │
   │        📱 HUAWEI & XIAOMI QUICK GAMES  •  👾 MSN & REDDIT GAMES        │
   └────────────────────────────────────────────────────────────────────────┘
```

**[🎮 Live Playable Demo](https://patience-play.vercel.app) • [📖 Documentation](#universal-multi-platform-matrix) • [🚀 Quickstart](#-quickstart)**

</div>

---

## 🌟 Overview

**Tap or Wait** is an adrenaline-fueled reaction game where quick reflexes alone aren't enough—mastering self-control is key. Tap on cyan prompts, resist on gold alerts, detect deceptive fake-outs, collect tactile power-ups, and survive progressively intense rounds.

Engineered from the ground up to run across **13 leading gaming ecosystems natively**, without using Playgama or any third-party SDK aggregators, wrapped in an **Apple Design System** with liquid glass surfaces, tactile spring physics, and Dynamic Island status telemetry.

---

## 🍎 Apple Design System & Fluid Motion

The game interface implements Apple's human interface guidelines and fluid physics:

- **Liquid Glass Materials**: Translucent panels (`backdrop-filter: blur(32px) saturate(200%)`) with multi-layered specular edge highlights and subtle depth staircasing.
- **Dynamic Island Telemetry**: Real-time status pill floating at the top of the viewport indicating the active platform runtime, monetization status, and streak multipliers.
- **Apple Bento Grid Layouts**: Clean, modular information tiles for game modes, daily seed challenges, accessibility preferences, and leaderboards.
- **Interruptible Spring Physics**: Natural deceleration and direct-manipulation tactile feedback with press scaling (`active:scale-[0.965]`).
- **OLED Dark Mode & Semantic Palette**: True-black OLED backgrounds accented by Apple System Blue (`#007aff`), Cyan, Electric Magenta, and Warm Amber.

---

## 🕹️ Universal Multi-Platform Matrix

Every platform is integrated **100% natively** without Playgama or third-party wrappers, through our modular adapter bridge (`src/lib/platform/`):

| Platform | Native Bridge / Namespace | Lifecycle Events | Cloud Saves | Interstitial Ads | Rewarded Ads (Revive) | Leaderboards |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **YouTube Playables** | `window.ytgame` (SDK v1) | `firstFrameReady`, `gameReady` | `loadData` / `saveData` (3MB) | `requestInterstitialAd` | `requestRewardedAd` | `sendScore` |
| **Facebook Instant Games** | `window.FBInstant` (v7.1) | `initializeAsync`, `startGameAsync` | `player.setDataAsync` | `getInterstitialAdAsync` | `getRewardedVideoAsync` | `getLeaderboardAsync` |
| **Poki** | `window.PokiSDK` | `gameLoadingFinished` | Native LocalStorage | `commercialBreak` | `rewardedBreak` | Game Scores |
| **CrazyGames** | `window.CrazyGames.SDK` (v3) | `game.loadingStop` | `data.setItem` / `getItem` | `ad.requestAd("midgame")` | `ad.requestAd("rewarded")` | HappyTime API |
| **Yandex Games** | `window.YaGames` | `LoadingAPI.ready` | `player.setData` | `adv.showFullscreenAdv` | `adv.showRewardedVideo` | `setLeaderboardScore` |
| **GameDistribution** | `window.gdsdk` | `gdsdk.showAd` | Native LocalStorage | `gdsdk.showAd()` | `gdsdk.showAd('rewarded')` | Web Highscores |
| **Discord Activities** | Embedded App SDK / RPC | `discordSdk.ready()` | Discord Storage KV | N/A (Activity Spec) | N/A (Activity Spec) | Voice Channel Board |
| **JioGames** | `window.JioGames` | `JioGames.init()` | Cloud Save Profile | `JioGames.showAd()` | `JioGames.showRewardedAd()` | `JioGames.postScore()` |
| **Y8 Games** | `window.ID` (ID.net) | `ID.init()` | ID Profile Data | `ID.ads.display()` | Supported Fallback | `ID.GameScore.submit()` |
| **Lagged** | `window.LaggedAPI` | `LaggedAPI.init()` | Lagged Profile Save | `LaggedAPI.showAd()` | `LaggedAPI.showRewardAd()` | `LaggedAPI.Scores.save()` |
| **Microsoft Store (PWA)** | `window.Windows` / PWA Manifest | `app.activated` | LocalStorage / IndexedDB | Non-intrusive Ad Sim | Simulated Revive Boost | Windows App Board |
| **Huawei & Xiaomi Quick Games** | `window.qg` (QuickApp) | Native App Lifecycle | `qg.setStorage` | `qg.createInterstitialAd` | `qg.createRewardedVideoAd` | QuickGame Board |
| **MSN & Reddit Games** | PostMessage / Iframe Sandbox | `GAME_READY` PostMessage | Parent PostMessage Save | `REQUEST_INTERSTITIAL` | `REQUEST_REWARDED` | `SUBMIT_SCORE` |
| **Standalone Web** | W3C Standard Web API | DOMContentLoaded | HTML5 LocalStorage | Graceful Fallback | Second Chance Boost | Local Device Record |

> 💡 **Instant Platform Switching**: Open **Settings ➔ Platform Engine** to test and preview all 13 platforms live in any browser without needing to deploy or switch environments.

---

## 📺 YouTube Playables Certified Integration

The repository strictly complies with the official **YouTube Playables Certification Specification**:

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

### Monetization & Ads Architecture
- **Pre-Roll Ads**: Handled automatically by the YouTube platform during initial bundle loading.
- **Interstitial Ads**: Executed at natural gameplay breakpoints (such as Game Over after completing multiple rounds or returning to main menu) with intelligent cooldown throttling:
  ```ts
  await ytgame.ads.requestInterstitialAd();
  ```
- **Rewarded Ads ("Second Chance / Revive")**: When a player makes an error, they can choose to watch an ad to revive with +1 Extra Life without losing their score or combo streak:
  ```ts
  const rewardEarned = await ytgame.ads.requestRewardedAd("second-chance-revive");
  if (rewardEarned) {
    // Revive player, grant extra life, continue gameplay
  }
  ```

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
Runs the full Vitest suite covering platform adapters, monetization flows, cloud saves, and YouTube Playables lifecycle.

### 4. Build for Production
```bash
npm run build
```
Creates an optimized, tree-shaken static production bundle in `dist/`.

---

## 📂 Project Architecture

```text
patience-play/
├── public/
│   ├── manifest.json            # PWA & Microsoft Store manifest
│   └── favicon.ico              # Apple icon & favicon
├── src/
│   ├── components/
│   │   └── TapOrWaitGame.tsx    # Core game loop, Bento UI, Apple spring animations
│   ├── lib/
│   │   ├── platform/            # 100% Native Multi-Platform Engine (Zero-Playgama)
│   │   │   ├── types.ts         # Unified PlatformAdapter interfaces
│   │   │   ├── platformManager.ts # Engine singleton & auto-detection
│   │   │   └── adapters/        # 13 Dedicated platform bridges
│   │   │       ├── youtubeAdapter.ts
│   │   │       ├── facebookAdapter.ts
│   │   │       ├── pokiAdapter.ts
│   │   │       ├── crazyGamesAdapter.ts
│   │   │       ├── yandexAdapter.ts
│   │   │       ├── gameDistributionAdapter.ts
│   │   │       ├── discordAdapter.ts
│   │   │       ├── jioGamesAdapter.ts
│   │   │       ├── y8Adapter.ts
│   │   │       ├── laggedAdapter.ts
│   │   │       ├── quickGamesAdapter.ts
│   │   │       ├── webIframeAdapter.ts
│   │   │       └── pwaAdapter.ts
│   │   ├── youtubePlayables.ts   # Safe YouTube SDK bridge with ads & telemetry
│   │   └── localization.ts      # Multi-language translation dictionaries
│   ├── types/
│   │   └── ytgame.d.ts          # Official YouTube Playables TypeScript definitions
│   ├── index.css                # Apple Design System tokens, Liquid Glass & springs
│   └── main.tsx                 # First frame ready notification & root mount
├── index.html                   # Earliest SDK insertion point & CSP meta tags
└── package.json
```

---

## 📜 License & Credits

Built with ❤️ by **Rahul Kumar**.

Licensed under the [MIT License](LICENSE).
