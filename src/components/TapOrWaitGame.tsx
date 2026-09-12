import { useState, useEffect, useCallback, useRef } from "react";
import {
  initializePlayables,
  loadGameData,
  notifyGameReady,
  saveGameData,
  sendBestScore,
  subscribeToSystemEvents,
} from "@/lib/youtubePlayables";
import { getCopy, getPrompts, getTutorialSteps } from "@/lib/localization";

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

type GamePhase = "menu" | "tutorial" | "countdown" | "playing" | "result" | "gameover" | "leaderboard" | "settings";
type RoundType = "tap" | "wait";
type RoundResult = "success" | "fail" | null;
type Difficulty = "easy" | "normal" | "hard";
type GameMode = "classic" | "endless" | "daily";
type TutorialStep = 0 | 1 | 2 | 3 | 4;
type PowerUpType = "time_freeze" | "double_points" | "extra_life";

interface GameSettings {
  sound: boolean;
  haptics: boolean;
  scanlineIntensity: number; // 0-100 (0 = off)
  reducedMotion: boolean;
  highContrast: boolean;
  accessibleCues: boolean;
}

const DEFAULT_SETTINGS: GameSettings = { sound: true, haptics: true, scanlineIntensity: 60, reducedMotion: false, highContrast: false, accessibleCues: true };

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem("tapOrWait_settings");
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Migrate old boolean `scanlines`
    if (typeof parsed.scanlines === "boolean" && parsed.scanlineIntensity == null) {
      parsed.scanlineIntensity = parsed.scanlines ? 60 : 0;
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch { return DEFAULT_SETTINGS; }
}

interface LeaderboardEntry {
  name: string;
  score: number;
  difficulty: Difficulty;
  maxCombo: number;
  date: string;
}

interface EndlessLeaderboardEntry {
  name: string;
  survivalMs: number;
  difficulty: Difficulty;
  rounds: number;
  date: string;
}

interface DailyLeaderboardEntry extends LeaderboardEntry {
  seed: string;
}

interface ActivePowerUp {
  type: PowerUpType;
  roundsLeft: number;
}

interface PowerUpPickup {
  type: PowerUpType;
  x: number;
  y: number;
  id: number;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; baseTime: number; minTime: number; decay: number; fakeAfterRound: number; fakeChance: number; powerUpChance: number }> = {
  easy: { label: "EASY", baseTime: 3000, minTime: 1200, decay: 60, fakeAfterRound: 5, fakeChance: 0.3, powerUpChance: 0.25 },
  normal: { label: "NORMAL", baseTime: 2000, minTime: 800, decay: 80, fakeAfterRound: 3, fakeChance: 0.5, powerUpChance: 0.18 },
  hard: { label: "HARD", baseTime: 1400, minTime: 500, decay: 100, fakeAfterRound: 1, fakeChance: 0.7, powerUpChance: 0.12 },
};

// Endless mode: per-difficulty spawn chance + weighted rarity per power-up type.
// Higher weight = more common. Extra-life is rarer on easy (don't need it) and more
// generous on hard (more deaths). Time-freeze is more useful as time pressure ramps.
const ENDLESS_POWER_UP_WEIGHTS: Record<Difficulty, { chance: number; weights: Record<PowerUpType, number> }> = {
  easy:   { chance: 0.30, weights: { time_freeze: 2, double_points: 4, extra_life: 1 } },
  normal: { chance: 0.22, weights: { time_freeze: 3, double_points: 2, extra_life: 2 } },
  hard:   { chance: 0.18, weights: { time_freeze: 4, double_points: 2, extra_life: 3 } },
};

function pickWeighted<K extends string>(weights: Record<K, number>, random = Math.random): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[0][0];
}

const POWER_UP_CONFIG: Record<PowerUpType, { label: string; icon: string; color: string; desc: string; duration: number }> = {
  time_freeze: { label: "TIME FREEZE", icon: "❄️", color: "hsl(200 100% 70%)", desc: "+50% time", duration: 3 },
  double_points: { label: "2× POINTS", icon: "⚡", color: "hsl(45 100% 55%)", desc: "Double score", duration: 3 },
  extra_life: { label: "EXTRA LIFE", icon: "💜", color: "hsl(320 100% 60%)", desc: "Survive 1 fail", duration: 1 },
};

function getRandomItem<T>(arr: T[], random = Math.random): T {
  return arr[Math.floor(random() * arr.length)];
}

function getDailySeed(): string {
  return new Date().toISOString().slice(0, 10);
}

function createSeededRandom(seed: string) {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 16777619);
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function vibrate(pattern: number | number[]) {
  if (!currentSettings.haptics) return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}

let currentSettings: GameSettings = loadSettings();

function playSound(type: "success" | "fail" | "tap" | "combo" | "powerup") {
  if (!currentSettings.sound) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (currentSettings.accessibleCues) {
      const tones = { success: 740, fail: 180, tap: 960, combo: 1120, powerup: 640 };
      osc.type = type === "fail" ? "square" : "sine";
      osc.frequency.setValueAtTime(tones[type], ctx.currentTime);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
      return;
    }
    switch (type) {
      case "success":
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
        break;
      case "fail":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
        break;
      case "tap":
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06);
        break;
      case "combo":
        osc.type = "sine";
        osc.frequency.setValueAtTime(784, ctx.currentTime);
        osc.frequency.setValueAtTime(988, ctx.currentTime + 0.06);
        osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
        break;
      case "powerup":
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.05);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
        break;
    }
  } catch {}
}

interface Particle {
  id: number; x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
}

function getLeaderboard(): LeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem("tapOrWait_leaderboard") || "[]"); } catch { return []; }
}

function saveToLeaderboard(entry: LeaderboardEntry) {
  const board = getLeaderboard();
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const top10 = board.slice(0, 10);
  localStorage.setItem("tapOrWait_leaderboard", JSON.stringify(top10));
  return top10;
}

function isLeaderboardWorthy(score: number): boolean {
  const board = getLeaderboard();
  if (board.length < 10) return score > 0;
  return score > board[board.length - 1].score;
}

function getEndlessLeaderboard(): EndlessLeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem("tapOrWait_endlessLeaderboard") || "[]"); } catch { return []; }
}

function saveToEndlessLeaderboard(entry: EndlessLeaderboardEntry) {
  const board = getEndlessLeaderboard();
  board.push(entry);
  board.sort((a, b) => b.survivalMs - a.survivalMs);
  const top10 = board.slice(0, 10);
  localStorage.setItem("tapOrWait_endlessLeaderboard", JSON.stringify(top10));
  return top10;
}

function isEndlessLeaderboardWorthy(ms: number): boolean {
  const board = getEndlessLeaderboard();
  if (board.length < 10) return ms > 0;
  return ms > board[board.length - 1].survivalMs;
}

function getDailyLeaderboard(seed: string): DailyLeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem(`tapOrWait_dailyLeaderboard_${seed}`) || "[]"); } catch { return []; }
}

function saveToDailyLeaderboard(seed: string, entry: DailyLeaderboardEntry) {
  const board = getDailyLeaderboard(seed);
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const top10 = board.slice(0, 10);
  localStorage.setItem(`tapOrWait_dailyLeaderboard_${seed}`, JSON.stringify(top10));
  return top10;
}

function isDailyLeaderboardWorthy(seed: string, score: number): boolean {
  const board = getDailyLeaderboard(seed);
  return board.length < 10 ? score > 0 : score > board[board.length - 1].score;
}

export default function TapOrWaitGame() {
  const dailySeed = getDailySeed();
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [mode, setMode] = useState<GameMode>("classic");
  const [settings, setSettings] = useState<GameSettings>(loadSettings());
  const [survivalMs, setSurvivalMs] = useState(0);
  const survivalStartRef = useRef(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem("tapOrWait_highScore") || "0"));
  const [roundType, setRoundType] = useState<RoundType>("tap");
  const [prompt, setPrompt] = useState("");
  const [roundResult, setRoundResult] = useState<RoundResult>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [tapped, setTapped] = useState(false);
  const [showFake, setShowFake] = useState(false);
  const [lastPoints, setLastPoints] = useState(0);
  const [screenShake, setScreenShake] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(0);
  const [tutorialTapped, setTutorialTapped] = useState(false);
  const [tutorialWaitDone, setTutorialWaitDone] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(getLeaderboard());
  const [endlessLeaderboard, setEndlessLeaderboard] = useState<EndlessLeaderboardEntry[]>(getEndlessLeaderboard());
  const [dailyLeaderboard, setDailyLeaderboard] = useState<DailyLeaderboardEntry[]>(() => getDailyLeaderboard(dailySeed));
  const [leaderboardTab, setLeaderboardTab] = useState<GameMode>("classic");
  const [playerName, setPlayerName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [platformAudioEnabled, setPlatformAudioEnabled] = useState(true);
  const [isPlatformPaused, setIsPlatformPaused] = useState(false);
  const [locale, setLocale] = useState(() => navigator.language || "en");

  // Power-up state
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [powerUpPickups, setPowerUpPickups] = useState<PowerUpPickup[]>([]);
  const [extraLives, setExtraLives] = useState(0);
  const [powerUpNotice, setPowerUpNotice] = useState<string | null>(null);

  const particleIdRef = useRef(0);
  const pickupIdRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fakeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartRef = useRef(0);
  const survivalMsRef = useRef(0);
  const noticeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const continuationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pickupExpiryTimersRef = useRef<NodeJS.Timeout[]>([]);
  const phaseRef = useRef<GamePhase>(phase);
  const shouldRestartRoundRef = useRef(false);
  const persistentDataRef = useRef({ version: 1 } as import("@/lib/youtubePlayables").PlayablesSaveData);
  const dailyRandomRef = useRef(createSeededRandom(dailySeed));
  const copy = getCopy(locale);
  const prompts = getPrompts(locale);
  const tutorialSteps = getTutorialSteps(locale);

  const showNotice = useCallback((text: string, ms = 1300) => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    setPowerUpNotice(text);
    noticeTimeoutRef.current = setTimeout(() => setPowerUpNotice(null), ms);
  }, []);

  const config = DIFFICULTY_CONFIG[difficulty];
  const random = useCallback(() => mode === "daily" ? dailyRandomRef.current() : Math.random(), [mode]);

  const hasActivePowerUp = useCallback((type: PowerUpType) => {
    return activePowerUps.some(p => p.type === type);
  }, [activePowerUps]);

  const getMaxTime = useCallback((currentRound: number) => {
    const decay = mode === "endless" ? config.decay * 1.6 : config.decay;
    const minTime = mode === "endless" ? Math.max(config.minTime - 200, 350) : config.minTime;
    let base = Math.max(config.baseTime - currentRound * decay, minTime);
    if (mode === "endless") {
      // Smooth survival ramp: every 10s shaves ~12% off the window, floor at 55%.
      const sec = survivalMsRef.current / 1000;
      const ramp = Math.max(0.55, 1 - sec * 0.012);
      base = Math.max(base * ramp, 300);
    }
    return hasActivePowerUp("time_freeze") ? Math.floor(base * 1.5) : base;
  }, [config, hasActivePowerUp, mode]);

  const maxTime = getMaxTime(round);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    if (fakeTimerRef.current) clearTimeout(fakeTimerRef.current);
    if (continuationTimerRef.current) clearTimeout(continuationTimerRef.current);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    pickupExpiryTimersRef.current.forEach((timer) => clearTimeout(timer));
    pickupExpiryTimersRef.current = [];
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    const boot = async () => {
      const [saved, system] = await Promise.all([loadGameData(), initializePlayables()]);
      if (!mounted) return;

      if (saved?.settings) setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
      if (typeof saved?.highScore === "number") setHighScore(saved.highScore);
      if (Array.isArray(saved?.leaderboard)) setLeaderboard(saved.leaderboard as LeaderboardEntry[]);
      if (Array.isArray(saved?.endlessLeaderboard)) setEndlessLeaderboard(saved.endlessLeaderboard as EndlessLeaderboardEntry[]);
      if (Array.isArray(saved?.dailyLeaderboard)) setDailyLeaderboard(saved.dailyLeaderboard as DailyLeaderboardEntry[]);
      setPlatformAudioEnabled(system.audioEnabled);
      setLocale(system.language);

      unsubscribe = subscribeToSystemEvents({
        onAudioEnabledChange: setPlatformAudioEnabled,
        onPause: () => {
          const activeRound = phaseRef.current === "playing";
          shouldRestartRoundRef.current = activeRound;
          clearAllTimers();
          setParticles([]);
          void saveGameData(persistentDataRef.current);
          setIsPlatformPaused(true);
        },
        onResume: () => setIsPlatformPaused(false),
      });
      setIsInitializing(false);
    };

    void boot();
    return () => { mounted = false; unsubscribe(); };
  }, [clearAllTimers]);

  useEffect(() => {
    if (!isInitializing) notifyGameReady();
  }, [isInitializing]);

  const spawnParticles = useCallback((color: string) => {
    if (currentSettings.reducedMotion) return;
    const newParticles: Particle[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      newParticles.push({
        id: particleIdRef.current++, x: 50, y: 50,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: Math.sin(angle) * (2 + Math.random() * 3),
        life: 1, color, size: 3 + Math.random() * 4,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => setParticles([]), 600);
  }, []);

  const triggerShake = useCallback(() => {
    if (currentSettings.reducedMotion) return;
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 400);
  }, []);

  // Spawn power-up pickup
  const maybeSpawnPowerUp = useCallback(() => {
    const endless = mode === "endless";
    const cfg = endless ? ENDLESS_POWER_UP_WEIGHTS[difficulty] : null;
    const chance = endless ? cfg!.chance : config.powerUpChance;
    if (random() > chance) return;

    const type: PowerUpType = endless
      ? pickWeighted<PowerUpType>(cfg!.weights, random)
      : getRandomItem(["time_freeze", "double_points", "extra_life"] as PowerUpType[], random);

    const pickup: PowerUpPickup = {
      type, id: pickupIdRef.current++,
      x: 15 + random() * 70,
      y: 15 + random() * 50,
    };
    setPowerUpPickups(prev => [...prev, pickup]);
    // Brief on-screen description when it appears
    const pcfg = POWER_UP_CONFIG[type];
    showNotice(`${pcfg.icon} ${pcfg.label} — ${pcfg.desc}`);
    // Auto-remove after 3 seconds if not collected
    const expiryTimer = setTimeout(() => {
      setPowerUpPickups(prev => prev.filter(p => p.id !== pickup.id));
      pickupExpiryTimersRef.current = pickupExpiryTimersRef.current.filter((timer) => timer !== expiryTimer);
    }, 3000);
    pickupExpiryTimersRef.current.push(expiryTimer);
  }, [config.powerUpChance, mode, difficulty, showNotice, random]);

  const collectPowerUp = useCallback((pickup: PowerUpPickup) => {
    setPowerUpPickups(prev => prev.filter(p => p.id !== pickup.id));
    playSound("powerup");
    vibrate([20, 10, 20]);
    const cfg = POWER_UP_CONFIG[pickup.type];

    if (pickup.type === "extra_life") {
      setExtraLives(prev => prev + 1);
    } else {
      setActivePowerUps(prev => {
        const existing = prev.find(p => p.type === pickup.type);
        if (existing) {
          return prev.map(p => p.type === pickup.type ? { ...p, roundsLeft: p.roundsLeft + cfg.duration } : p);
        }
        return [...prev, { type: pickup.type, roundsLeft: cfg.duration }];
      });
    }

    showNotice(`${cfg.icon} ${cfg.label} ACTIVE — ${cfg.desc}`);
    spawnParticles(cfg.color);
  }, [spawnParticles, showNotice]);

  // Tick down power-up durations after each round; surface expiry notices.
  const tickPowerUps = useCallback(() => {
    setActivePowerUps(prev => {
      const next = prev.map(p => ({ ...p, roundsLeft: p.roundsLeft - 1 }));
      const expired = next.filter(p => p.roundsLeft <= 0);
      if (expired.length > 0) {
        const e = expired[0];
        const cfg = POWER_UP_CONFIG[e.type];
        showNotice(`${cfg.icon} ${cfg.label} EXPIRED`);
      }
      return next.filter(p => p.roundsLeft > 0);
    });
  }, [showNotice]);

  const startGame = () => {
    setScore(0); setRound(0); setCombo(0); setMaxCombo(0);
    setShowNameInput(false); setActivePowerUps([]); setPowerUpPickups([]);
    setExtraLives(0); setPowerUpNotice(null);
    setSurvivalMs(0);
    survivalMsRef.current = 0;
    survivalStartRef.current = Date.now();
    if (mode === "daily") dailyRandomRef.current = createSeededRandom(dailySeed);
    setPhase("countdown"); setCountdown(3);
  };

  // Survival timer ticker (endless mode)
  useEffect(() => {
    if (mode !== "endless" || isPlatformPaused) return;
    if (phase !== "playing" && phase !== "result") return;
    const id = setInterval(() => {
      const ms = Date.now() - survivalStartRef.current;
      survivalMsRef.current = ms;
      setSurvivalMs(ms);
    }, 100);
    return () => clearInterval(id);
  }, [mode, phase, isPlatformPaused]);

  // Persist local settings and mirror the player profile to YouTube cloud saves.
  useEffect(() => {
    currentSettings = { ...settings, sound: settings.sound && platformAudioEnabled };
    localStorage.setItem("tapOrWait_settings", JSON.stringify(settings));
  }, [settings, platformAudioEnabled]);

  useEffect(() => {
    const data = { version: 1 as const, settings, highScore, leaderboard, endlessLeaderboard, dailyLeaderboard };
    persistentDataRef.current = data;
    if (!isInitializing) void saveGameData(data);
  }, [isInitializing, settings, highScore, leaderboard, endlessLeaderboard, dailyLeaderboard]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown" || isPlatformPaused) return;
    if (countdown <= 0) { startRound(0); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown, isPlatformPaused]);

  const startRound = useCallback((currentRound: number) => {
    clearAllTimers();
    setTapped(false); setRoundResult(null); setShowFake(false); setComboFlash(false);

    const type: RoundType = random() > 0.45 ? "tap" : "wait";
    setRoundType(type);

    const time = getMaxTime(currentRound);

    // Maybe spawn a power-up
    if (currentRound > 1) maybeSpawnPowerUp();

    if (currentRound > config.fakeAfterRound && random() < config.fakeChance) {
      setPrompt(getRandomItem(prompts.fake, random));
      setShowFake(true);
      setPhase("playing");
      roundStartRef.current = Date.now();

      fakeTimerRef.current = setTimeout(() => {
        setShowFake(false);
        setPrompt(type === "tap" ? getRandomItem(prompts.tap, random) : getRandomItem(prompts.wait, random));
        roundStartRef.current = Date.now();
        setTimeLeft(time);
        if (type === "tap") {
          timerRef.current = setTimeout(() => handleRoundEnd(false, currentRound), time);
        } else {
          waitTimerRef.current = setTimeout(() => handleRoundEnd(true, currentRound), time);
        }
      }, mode === "daily" ? 800 : 600 + Math.random() * 800);
    } else {
      setPrompt(type === "tap" ? getRandomItem(prompts.tap, random) : getRandomItem(prompts.wait, random));
      setPhase("playing");
      roundStartRef.current = Date.now();
      setTimeLeft(time);
      if (type === "tap") {
        timerRef.current = setTimeout(() => handleRoundEnd(false, currentRound), time);
      } else {
        waitTimerRef.current = setTimeout(() => handleRoundEnd(true, currentRound), time);
      }
    }
  }, [clearAllTimers, config, getMaxTime, maybeSpawnPowerUp, mode, prompts, random]);

  const handleRoundEnd = useCallback((success: boolean, currentRound: number) => {
    clearAllTimers();
    setPowerUpPickups([]); // Clear uncollected pickups

    if (success) {
      const reaction = Date.now() - roundStartRef.current;
      const bonus = Math.max(0, Math.floor((2000 - reaction) / 10));
      const doubleActive = hasActivePowerUp("double_points");

      setCombo(prev => {
        const newCombo = prev + 1;
        const multiplier = Math.min(1 + (newCombo - 1) * 0.25, 4);
        let points = Math.floor((100 + bonus) * multiplier);
        if (doubleActive) points *= 2;
        setLastPoints(points);
        setScore(s => s + points);
        if (newCombo > 1) {
          setComboFlash(true);
          if (newCombo >= 5) playSound("combo"); else playSound("success");
        } else playSound("success");
        if (newCombo > maxCombo) setMaxCombo(newCombo);
        return newCombo;
      });

      vibrate(30); triggerShake(); spawnParticles("hsl(174 100% 50%)");
      setRoundResult("success"); setPhase("result");
      tickPowerUps();

      continuationTimerRef.current = setTimeout(() => {
        const nextRound = currentRound + 1;
        setRound(nextRound);
        startRound(nextRound);
      }, 800);
    } else {
      // Check extra life
      if (extraLives > 0) {
        setExtraLives(prev => prev - 1);
        playSound("powerup");
        vibrate([20, 10, 20, 10, 20]);
        showNotice("💜 EXTRA LIFE USED — Survived this fail!");
        spawnParticles("hsl(320 100% 60%)");
        setCombo(0);
        setRoundResult("fail");
        setPhase("result");
        tickPowerUps();

        continuationTimerRef.current = setTimeout(() => {
          const nextRound = currentRound + 1;
          setRound(nextRound);
          startRound(nextRound);
        }, 1000);
        return;
      }

      playSound("fail"); vibrate([50, 30, 50, 30, 80]);
      triggerShake(); spawnParticles("hsl(0 85% 55%)");
      setCombo(0); setRoundResult("fail"); setPhase("gameover");
      setScore(prev => {
        if (prev > highScore) {
          setHighScore(prev);
          localStorage.setItem("tapOrWait_highScore", prev.toString());
        }
        if (mode === "endless") {
          if (isEndlessLeaderboardWorthy(survivalMsRef.current)) setShowNameInput(true);
        } else if (mode === "daily") {
          if (isDailyLeaderboardWorthy(dailySeed, prev)) setShowNameInput(true);
        } else {
          if (isLeaderboardWorthy(prev)) setShowNameInput(true);
        }
        return prev;
      });
    }
  }, [clearAllTimers, highScore, startRound, maxCombo, triggerShake, spawnParticles, tickPowerUps, hasActivePowerUp, extraLives, mode, showNotice, dailySeed]);

  const handleTap = useCallback(() => {
    if (phase !== "playing" || tapped) return;
    setTapped(true); vibrate(15); playSound("tap");
    if (showFake) { handleRoundEnd(false, round); return; }
    if (roundType === "tap") handleRoundEnd(true, round);
    else handleRoundEnd(false, round);
  }, [phase, tapped, showFake, roundType, round, handleRoundEnd]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (phase === "tutorial" || phase === "leaderboard" || phase === "settings") setPhase("menu");
        return;
      }
      if (event.key.toLowerCase() === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
        return;
      }
      if (!isPlatformPaused && phase === "playing" && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        handleTap();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, isPlatformPaused, handleTap]);

  useEffect(() => {
    if (!isPlatformPaused || !shouldRestartRoundRef.current) return;
    shouldRestartRoundRef.current = false;
    startRound(round);
  }, [isPlatformPaused, round, startRound]);

  // Timer bar
  useEffect(() => {
    if (phase !== "playing" || showFake || isPlatformPaused) return;
    const curMaxTime = getMaxTime(round);
    const interval = setInterval(() => {
      const elapsed = Date.now() - roundStartRef.current;
      const remaining = Math.max(0, curMaxTime - elapsed);
      setTimeLeft(remaining);
    }, 30);
    return () => clearInterval(interval);
  }, [phase, showFake, round, getMaxTime, isPlatformPaused]);

  useEffect(() => {
    if (phase === "gameover" && score > highScore) {
      setHighScore(score);
      localStorage.setItem("tapOrWait_highScore", score.toString());
      void sendBestScore(score);
    }
  }, [phase, score, highScore]);

  // Tutorial wait practice
  useEffect(() => {
    if (!isPlatformPaused && phase === "tutorial" && tutorialStep === 2 && !tutorialWaitDone) {
      const t = setTimeout(() => {
        setTutorialWaitDone(true); playSound("success"); vibrate(30);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [phase, tutorialStep, tutorialWaitDone, isPlatformPaused]);

  // Particle animation
  useEffect(() => {
    if (particles.length === 0 || isPlatformPaused) return;
    const interval = setInterval(() => {
      setParticles(prev =>
        prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.05, vy: p.vy + 0.1 })).filter(p => p.life > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, [particles.length, isPlatformPaused]);

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: "viewport-relative; center interaction target; x increases right and y increases down",
      phase, mode, difficulty, round: round + 1, score, combo, prompt, roundType,
      timeLeft: Math.round(timeLeft), paused: isPlatformPaused,
      pickups: powerUpPickups.map(({ type, x, y }) => ({ type, x: Math.round(x), y: Math.round(y) })),
      activePowerUps, extraLives,
    });
    return () => { delete window.render_game_to_text; };
  }, [phase, mode, difficulty, round, score, combo, prompt, roundType, timeLeft, isPlatformPaused, powerUpPickups, activePowerUps, extraLives]);

  const handleSaveScore = () => {
    const name = (playerName.trim() || "ANON").toUpperCase().slice(0, 10);
    const date = new Date().toLocaleDateString();
    if (mode === "endless") {
      const updated = saveToEndlessLeaderboard({
        name, survivalMs: survivalMsRef.current, difficulty, rounds: round, date,
      });
      setEndlessLeaderboard(updated);
      setLeaderboardTab("endless");
    } else if (mode === "daily") {
      const updated = saveToDailyLeaderboard(dailySeed, { name, score, difficulty, maxCombo, date, seed: dailySeed });
      setDailyLeaderboard(updated);
      setLeaderboardTab("daily");
    } else {
      const updated = saveToLeaderboard({ name, score, difficulty, maxCombo, date });
      setLeaderboard(updated);
      setLeaderboardTab("classic");
    }
    setShowNameInput(false);
  };

  const timerPercent = maxTime > 0 ? (timeLeft / maxTime) * 100 : 0;
  const comboMultiplier = Math.min(1 + (combo - 1) * 0.25, 4);

  if (isInitializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background font-display text-sm tracking-widest text-primary">
        {copy.loading}
      </div>
    );
  }

  return (
    <div
      data-testid="game-shell"
      className={`game-shell fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden transition-transform duration-75 ${screenShake ? "animate-shake" : ""} ${settings.reducedMotion ? "reduce-motion" : ""} ${settings.highContrast ? "high-contrast" : ""}`}
      onPointerDown={phase === "playing" && !isPlatformPaused ? handleTap : undefined}
    >
      {/* Retro grid background */}
      <div className="retro-grid" />
      <div className="sr-only" aria-live="polite">
        {phase === "playing" ? `${copy.round} ${round + 1}. ${prompt}` : phase === "gameover" ? copy.gameOver : ""}
      </div>
      {isPlatformPaused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <span className="font-display text-xl text-primary text-glow-cyan">{copy.paused}</span>
        </div>
      )}
      {/* Scanline overlay (intensity slider) */}
      {settings.scanlineIntensity > 0 && (
        <div className="scanlines" style={{ opacity: settings.scanlineIntensity / 100 }} />
      )}
      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none z-20"
          style={{
            left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size,
            backgroundColor: p.color, opacity: p.life,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}

      {/* Power-up pickups */}
      {powerUpPickups.map(pickup => {
        const pcfg = POWER_UP_CONFIG[pickup.type];
        return (
          <div
            key={pickup.id}
            className="absolute z-30 cursor-pointer animate-pulse-ring flex flex-col items-center gap-1"
            style={{ left: `${pickup.x}%`, top: `${pickup.y}%` }}
            onPointerDown={(e) => { e.stopPropagation(); collectPowerUp(pickup); }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 backdrop-blur-sm"
              style={{
                backgroundColor: `${pcfg.color.replace(")", " / 0.2)")}`,
                borderColor: pcfg.color,
                boxShadow: `0 0 15px ${pcfg.color}, 0 0 30px ${pcfg.color.replace(")", " / 0.3)")}`,
              }}
            >
              {pcfg.icon}
            </div>
            <span
              className="font-display text-[9px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded"
              style={{ color: pcfg.color, backgroundColor: "hsl(240 15% 6% / 0.7)" }}
            >
              {pcfg.label}
            </span>
            <span className="font-display text-[8px] text-muted-foreground whitespace-nowrap">
              {pcfg.desc}
            </span>
          </div>
        );
      })}

      {/* Power-up notice */}
      {powerUpNotice && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 font-display text-sm font-bold text-foreground animate-float-up px-4 py-2 rounded-lg bg-card/80 border border-border backdrop-blur-sm">
          {powerUpNotice}
        </div>
      )}

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] transition-colors duration-300"
          style={{
            backgroundColor:
              phase === "playing" && !showFake
                ? roundType === "tap" ? "hsl(174 100% 50%)" : "hsl(45 100% 55%)"
                : phase === "gameover" ? "hsl(0 85% 55%)" : "hsl(320 100% 60%)",
          }}
        />
      </div>

      {/* Header */}
      {(phase === "playing" || phase === "result") && (
        <div className="absolute top-6 left-0 right-0 flex justify-between items-start px-6 z-10">
          <div className="flex flex-col gap-1">
            <div className="font-display text-sm text-muted-foreground">
              RD <span className="text-foreground">{round + 1}</span>
            </div>
            <div className="font-display text-[10px] text-muted-foreground uppercase tracking-wider">
              {config.label} {mode === "endless" && "• ENDLESS"}
            </div>
            {mode === "endless" && (
              <div className="font-display text-xs text-secondary text-glow-magenta">
                ⏱ {(survivalMs / 1000).toFixed(1)}s
              </div>
            )}
            {/* Active power-ups indicator */}
            {(activePowerUps.length > 0 || extraLives > 0) && (
              <div className="flex gap-1 mt-1">
                {activePowerUps.map(p => (
                  <span
                    key={p.type}
                    className="text-[10px] font-display px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${POWER_UP_CONFIG[p.type].color.replace(")", " / 0.2)")}`,
                      color: POWER_UP_CONFIG[p.type].color,
                      border: `1px solid ${POWER_UP_CONFIG[p.type].color.replace(")", " / 0.4)")}`,
                    }}
                  >
                    {POWER_UP_CONFIG[p.type].icon}{p.roundsLeft}
                  </span>
                ))}
                {extraLives > 0 && (
                  <span className="text-[10px] font-display px-1.5 py-0.5 rounded bg-secondary/20 text-secondary border border-secondary/40">
                    💜{extraLives}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-display text-sm text-primary text-glow-cyan">
              {score}
            </div>
            {combo > 1 && (
              <div className={`font-display text-[10px] text-accent text-glow-gold transition-all ${comboFlash ? "scale-125" : ""}`}>
                {combo}x COMBO • {comboMultiplier.toFixed(2)}×
              </div>
            )}
            {hasActivePowerUp("double_points") && (
              <div className="font-display text-[10px] text-accent text-glow-gold animate-pulse">
                ⚡ 2× ACTIVE
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timer bar */}
      {phase === "playing" && !showFake && (
        <div className="absolute top-0 left-0 right-0 h-1">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${timerPercent}%`,
              backgroundColor:
                hasActivePowerUp("time_freeze")
                  ? "hsl(200 100% 70%)"
                  : timerPercent > 50 ? "hsl(174 100% 50%)"
                  : timerPercent > 25 ? "hsl(45 100% 55%)"
                  : "hsl(0 85% 55%)",
            }}
          />
        </div>
      )}

      {/* MENU */}
      {phase === "menu" && (
        <div className="menu-panel flex max-h-full flex-col items-center gap-4 overflow-y-auto px-6 py-5 z-10">
          <h1 className="font-display font-black text-[clamp(2.5rem,13vw,5rem)] text-primary text-glow-cyan tracking-wider">
            {copy.title}
          </h1>
          <div className="font-display text-2xl md:text-3xl text-secondary text-glow-magenta">
            {copy.subtitle}
          </div>
          <p className="text-muted-foreground text-center text-sm max-w-xs leading-relaxed mt-1">
            {copy.intro}
          </p>

          {/* Difficulty selector */}
          <div className="flex gap-2 mt-2">
            {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-4 py-2 rounded-lg font-display text-xs font-bold transition-all ${
                  difficulty === d
                    ? d === "easy" ? "bg-game-success/20 text-game-success border border-game-success/50"
                      : d === "normal" ? "bg-primary/20 text-primary border border-primary/50 glow-cyan"
                      : "bg-destructive/20 text-destructive border border-destructive/50"
                    : "bg-muted text-muted-foreground border border-border hover:border-foreground/30"
                }`}
              >
                {DIFFICULTY_CONFIG[d].label}
              </button>
            ))}
          </div>

          {/* Mode selector */}
          <div className="flex gap-2">
            {(["classic", "endless", "daily"] as GameMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg font-display text-xs font-bold transition-all ${
                  mode === m
                    ? "bg-secondary/20 text-secondary border border-secondary/50 glow-magenta"
                    : "bg-muted text-muted-foreground border border-border hover:border-foreground/30"
                }`}
              >
                {m === "classic" ? copy.classic : m === "endless" ? copy.endless : `${copy.daily} ${dailySeed.slice(5)}`}
              </button>
            ))}
          </div>

          {mode === "daily" && (
            <div data-testid="daily-challenge-card" className="w-full max-w-xs rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-center shadow-[0_0_28px_hsl(45_100%_55%_/_0.12)]">
              <div className="font-display text-[10px] tracking-[0.24em] text-accent">DAILY SIGNAL</div>
              <div className="mt-1 font-display text-sm text-foreground">{dailySeed}</div>
              <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">One shared sequence. One chance to climb today&apos;s board.</div>
            </div>
          )}

          <button
            onClick={startGame}
            data-testid="play-button"
            aria-label={copy.play}
            className="mt-2 px-10 py-4 bg-primary text-primary-foreground font-display font-bold text-lg rounded-xl glow-cyan hover:scale-105 active:scale-95 transition-transform"
          >
            {copy.play}
          </button>

          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => { setTutorialStep(0); setTutorialTapped(false); setTutorialWaitDone(false); setPhase("tutorial"); }}
              className="px-5 py-2 font-display text-xs text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/10 transition-colors"
            >
              {copy.tutorial}
            </button>
            <button
              onClick={() => {
                setLeaderboard(getLeaderboard());
                setEndlessLeaderboard(getEndlessLeaderboard());
                setDailyLeaderboard(getDailyLeaderboard(dailySeed));
                setLeaderboardTab(mode);
                setPhase("leaderboard");
              }}
              className="px-5 py-2 font-display text-xs text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
            >
              {copy.leaderboard}
            </button>
            <button
              onClick={() => setPhase("settings")}
              className="px-5 py-2 font-display text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
            >
              {copy.settings}
            </button>
          </div>

          {highScore > 0 && (
            <div className="text-accent font-display text-sm text-glow-gold">
              BEST: {highScore}
            </div>
          )}
        </div>
      )}

      {/* TUTORIAL */}
      {phase === "tutorial" && (
        <div className="flex flex-col items-center gap-6 z-10 px-6 max-w-sm">
          <div className="font-display text-xs text-muted-foreground tracking-widest">
            STEP {tutorialStep + 1} / {tutorialSteps.length}
          </div>
          <h2 className="font-display font-bold text-3xl text-primary text-glow-cyan">
            {tutorialSteps[tutorialStep].title}
          </h2>
          <p className="text-foreground/80 text-center text-sm leading-relaxed whitespace-pre-line">
            {tutorialSteps[tutorialStep].desc}
          </p>

          {tutorialStep === 1 && (
            <div
              className={`w-32 h-32 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                tutorialTapped ? "bg-game-success/20 border-game-success scale-110" : "bg-primary/20 border-primary glow-cyan animate-pulse-ring"
              }`}
              onPointerDown={() => {
                if (!tutorialTapped) {
                  setTutorialTapped(true); playSound("success"); vibrate(30);
                  triggerShake(); spawnParticles("hsl(174 100% 50%)");
                }
              }}
            >
              <span className="font-display font-bold text-sm text-primary text-glow-cyan">
                {tutorialTapped ? "NICE!" : "TAP ME"}
              </span>
            </div>
          )}

          {tutorialStep === 2 && (
            <div
              className={`w-32 h-32 rounded-full border-2 flex items-center justify-center transition-all ${
                tutorialWaitDone ? "bg-game-success/20 border-game-success scale-110" : "bg-accent/10 border-accent glow-gold"
              }`}
              onPointerDown={() => {
                if (!tutorialWaitDone) {
                  playSound("fail"); vibrate([50, 30, 50]); triggerShake();
                  spawnParticles("hsl(0 85% 55%)");
                }
              }}
            >
              <span className={`font-display font-bold text-sm ${tutorialWaitDone ? "text-game-success" : "text-accent text-glow-gold"}`}>
                {tutorialWaitDone ? "GREAT!" : "DON'T TAP"}
              </span>
            </div>
          )}

          {tutorialStep === 3 && (
            <div className="w-32 h-32 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center glow-magenta">
              <span className="font-display font-bold text-sm text-secondary text-glow-magenta text-center">
                TAP... NOT!
              </span>
            </div>
          )}

          <button
            onClick={() => {
              if (tutorialStep === 1 && !tutorialTapped) return;
              if (tutorialStep === 2 && !tutorialWaitDone) return;
              if (tutorialStep >= 4) { setPhase("menu"); return; }
              const next = (tutorialStep + 1) as TutorialStep;
              setTutorialStep(next);
              if (next === 2) setTutorialWaitDone(false);
            }}
            className={`mt-2 px-8 py-3 font-display font-bold text-sm rounded-xl transition-all ${
              (tutorialStep === 1 && !tutorialTapped) || (tutorialStep === 2 && !tutorialWaitDone)
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : tutorialStep >= 4
                ? "bg-primary text-primary-foreground glow-cyan hover:scale-105 active:scale-95"
                : "bg-card text-foreground border border-border hover:border-primary/50 hover:scale-105 active:scale-95"
            }`}
          >
            {tutorialSteps[tutorialStep].action}
          </button>

          <button
            onClick={() => setPhase("menu")}
            className="font-display text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copy.menu}
          </button>
        </div>
      )}

      {/* COUNTDOWN */}
      {phase === "countdown" && (
        <div className="flex items-center justify-center z-10">
          <span key={countdown} className="font-display font-black text-8xl text-primary text-glow-cyan animate-countdown-pulse">
            {countdown || copy.play}
          </span>
        </div>
      )}

      {/* PLAYING */}
      {phase === "playing" && (
        <div className="flex flex-col items-center justify-center gap-6 z-10 px-6">
          {showFake ? (
            <div className="font-display font-bold text-3xl md:text-5xl text-secondary text-glow-magenta animate-pulse-ring text-center">
              {prompt}
            </div>
          ) : roundType === "tap" ? (
            <>
              <div className="w-40 h-40 md:w-52 md:h-52 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center glow-cyan animate-pulse-ring">
                <span className="font-display font-black text-2xl md:text-3xl text-primary text-glow-cyan text-center">
                  {prompt}
                </span>
              </div>
              <p className="text-primary/60 text-xs font-display">{copy.tapAnywhere}</p>
            </>
          ) : (
            <>
              <div className="w-40 h-40 md:w-52 md:h-52 rounded-full bg-accent/10 border-2 border-accent flex items-center justify-center glow-gold">
                <span className="font-display font-black text-2xl md:text-3xl text-accent text-glow-gold text-center">
                  {prompt}
                </span>
              </div>
              <p className="text-accent/60 text-xs font-display">{copy.doNotTap}</p>
            </>
          )}
          {hasActivePowerUp("time_freeze") && (
            <div className="font-display text-[10px] text-[hsl(200_100%_70%)] animate-pulse">❄️ TIME SLOWED</div>
          )}
        </div>
      )}

      {/* RESULT FLASH */}
      {phase === "result" && (
        <div className="flex flex-col items-center justify-center gap-2 z-10">
          <span className="font-display font-black text-5xl text-game-success" style={{ textShadow: "0 0 15px hsl(140 70% 50% / 0.8)" }}>
            ✓
          </span>
          {lastPoints > 0 && (
            <span className="font-display text-sm text-primary text-glow-cyan animate-float-up">
              +{lastPoints}{hasActivePowerUp("double_points") ? " ⚡" : ""}
            </span>
          )}
          {combo > 1 && (
            <span className="font-display text-xs text-accent text-glow-gold">
              {combo}x COMBO!
            </span>
          )}
        </div>
      )}

      {/* GAME OVER */}
      {phase === "gameover" && (
        <div className="flex flex-col items-center gap-5 z-10 px-6">
          <div className="font-display font-black text-4xl md:text-6xl text-destructive" style={{ textShadow: "0 0 20px hsl(0 85% 55% / 0.8)" }}>
            {copy.gameOver}
          </div>
          <div className="flex flex-col items-center gap-2 mt-3">
            <span className="text-muted-foreground text-sm font-display">{copy.score}</span>
            <span className="font-display font-bold text-3xl text-foreground">{score}</span>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground text-xs font-display">{copy.best}</span>
              <span className="font-display text-accent text-glow-gold text-lg">{highScore}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground text-xs font-display">{copy.maxCombo}</span>
              <span className="font-display text-secondary text-glow-magenta text-lg">{maxCombo}x</span>
            </div>
          </div>
          <div className="text-muted-foreground text-xs mt-1">
            Survived {round} round{round !== 1 ? "s" : ""} on {config.label}
            {mode === "endless" && ` • ${(survivalMs / 1000).toFixed(1)}s ENDLESS`}
            {mode === "daily" && ` • ${copy.daily} ${dailySeed}`}
          </div>

          {showNameInput && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <span className="font-display text-xs text-primary text-glow-cyan">{copy.newHighScore}</span>
              <div className="flex gap-2">
                <input
                  type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
                  maxLength={10} placeholder={copy.yourName}
                  className="px-3 py-2 bg-card border border-border rounded-lg font-display text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-32 text-center uppercase"
                  autoFocus onKeyDown={e => e.key === "Enter" && handleSaveScore()}
                />
                <button onClick={handleSaveScore}
                  className="px-4 py-2 bg-primary text-primary-foreground font-display text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-transform">
                  {copy.save}
                </button>
              </div>
            </div>
          )}

          <button onClick={startGame}
            className="mt-3 px-10 py-4 bg-primary text-primary-foreground font-display font-bold text-lg rounded-xl glow-cyan hover:scale-105 active:scale-95 transition-transform">
            {copy.retry}
          </button>
          <button onClick={() => setPhase("menu")}
            className="px-6 py-2 font-display text-xs text-muted-foreground hover:text-foreground transition-colors">
            {copy.menu}
          </button>
        </div>
      )}

      {/* LEADERBOARD */}
      {phase === "leaderboard" && (() => {
        const isEndless = leaderboardTab === "endless";
        const isDaily = leaderboardTab === "daily";
        const list: (LeaderboardEntry | EndlessLeaderboardEntry | DailyLeaderboardEntry)[] = isEndless ? endlessLeaderboard : isDaily ? dailyLeaderboard : leaderboard;
        return (
          <div className="flex flex-col items-center gap-4 z-10 px-6 max-w-sm w-full">
            <h2 className="font-display font-bold text-3xl text-accent text-glow-gold">
              {isDaily ? `${copy.daily} ${copy.leaderboard}` : copy.leaderboard}
            </h2>
            {/* Tabs */}
            <div className="flex gap-2">
              {(["classic", "endless", "daily"] as GameMode[]).map(t => (
                <button
                  key={t}
                  onClick={() => setLeaderboardTab(t)}
                  className={`px-4 py-2 rounded-lg font-display text-xs font-bold transition-all ${
                    leaderboardTab === t
                      ? t === "classic"
                        ? "bg-primary/20 text-primary border border-primary/50 glow-cyan"
                        : t === "endless" ? "bg-secondary/20 text-secondary border border-secondary/50 glow-magenta" : "bg-accent/20 text-accent border border-accent/50 glow-gold"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {t === "classic" ? copy.classic : t === "endless" ? copy.endless : copy.daily}
                </button>
              ))}
            </div>
            {list.length === 0 ? (
              <p className="text-muted-foreground text-sm font-display mt-4 text-center">
                {copy.noScores}<br/>{copy.playToRank}
              </p>
            ) : (
              <div className="w-full flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2 px-3 py-1 text-muted-foreground font-display text-[10px] uppercase tracking-wider">
                  <span className="w-6">#</span>
                  <span className="flex-1">NAME</span>
                  <span className="w-16 text-right">{isEndless ? "TIME" : copy.score}</span>
                  <span className="w-12 text-right">{isEndless ? "RDS" : "COMBO"}</span>
                  <span className="w-12 text-right">DIFF</span>
                </div>
                {list.map((entry, i) => (
                  <div key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-display text-xs ${
                      i === 0 ? "bg-accent/10 border border-accent/30 text-accent"
                      : i === 1 ? "bg-foreground/5 border border-foreground/10 text-foreground/80"
                      : i === 2 ? "bg-secondary/5 border border-secondary/10 text-secondary/80"
                      : "bg-card/50 text-muted-foreground"
                    }`}>
                    <span className="w-6 font-bold">{i + 1}</span>
                    <span className="flex-1 truncate">{entry.name}</span>
                    <span className="w-16 text-right font-bold">
                      {isEndless
                        ? `${((entry as EndlessLeaderboardEntry).survivalMs / 1000).toFixed(1)}s`
                        : (entry as LeaderboardEntry).score}
                    </span>
                    <span className="w-12 text-right">
                      {isEndless
                        ? (entry as EndlessLeaderboardEntry).rounds
                        : `${(entry as LeaderboardEntry).maxCombo}x`}
                    </span>
                    <span className="w-12 text-right text-[10px]">{DIFFICULTY_CONFIG[entry.difficulty]?.label || "?"}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setPhase("menu")}
              className="mt-4 px-8 py-3 bg-card text-foreground font-display font-bold text-sm rounded-xl border border-border hover:border-primary/50 hover:scale-105 active:scale-95 transition-all">
              {copy.back}
            </button>
          </div>
        );
      })()}

      {/* SETTINGS */}
      {phase === "settings" && (
        <div className="flex flex-col items-center gap-5 z-10 px-6 max-w-sm w-full">
          <h2 className="font-display font-bold text-3xl text-primary text-glow-cyan">
            {copy.settings}
          </h2>
          <div className="w-full flex flex-col gap-3 mt-2">
            {([
              { key: "sound", label: `🔊 ${copy.sound}`, desc: "Synth tones on actions" },
              { key: "haptics", label: `📳 ${copy.haptics}`, desc: "Vibrate on tap & events" },
              { key: "reducedMotion", label: `◌ ${copy.reducedMotion}`, desc: "Stops screen shake and particle motion" },
              { key: "highContrast", label: `◐ ${copy.highContrast}`, desc: "Makes text and controls easier to see" },
              { key: "accessibleCues", label: `♫ ${copy.accessibleCues}`, desc: "Uses clear, distinct game tones" },
            ] as { key: "sound" | "haptics" | "reducedMotion" | "highContrast" | "accessibleCues"; label: string; desc: string }[]).map(item => (
              <button
                key={item.key}
                onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
                className="flex items-center justify-between gap-4 px-4 py-3 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-col items-start">
                  <span className="font-display font-bold text-sm text-foreground">{item.label}</span>
                  <span className="text-muted-foreground text-[10px]">{item.desc}</span>
                </div>
                <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${settings[item.key] ? "bg-primary" : "bg-muted"}`}>
                  <div className={`w-5 h-5 rounded-full bg-background transition-transform ${settings[item.key] ? "translate-x-5" : ""}`} />
                </div>
              </button>
            ))}

            {/* Scanline intensity slider */}
            <div className="flex flex-col gap-2 px-4 py-3 bg-card border border-border rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="font-display font-bold text-sm text-foreground">📺 {copy.scanlines}</span>
                  <span className="text-muted-foreground text-[10px]">Tune CRT overlay strength (Samsung-friendly)</span>
                </div>
                <span className="font-display text-xs text-primary text-glow-cyan tabular-nums">
                  {settings.scanlineIntensity === 0 ? "OFF" : `${settings.scanlineIntensity}%`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.scanlineIntensity}
                onChange={(e) => setSettings(s => ({ ...s, scanlineIntensity: parseInt(e.target.value) }))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground font-display">
                <span>OFF</span>
                <span>SUBTLE</span>
                <span>FULL</span>
              </div>
            </div>
            <div className="px-4 py-3 bg-card border border-border rounded-xl font-display text-xs text-muted-foreground">
              🌐 {copy.auto}: {locale}
            </div>
          </div>

          <div className="font-display text-[9px] tracking-wide text-muted-foreground/80">SPACE / ENTER TO TAP · F FOR FULLSCREEN</div>
          <button onClick={() => setPhase("menu")}
            className="mt-4 px-8 py-3 bg-card text-foreground font-display font-bold text-sm rounded-xl border border-border hover:border-primary/50 hover:scale-105 active:scale-95 transition-all">
            {copy.back}
          </button>
        </div>
      )}
    </div>
  );
}
