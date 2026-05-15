import { useState, useEffect, useCallback, useRef } from "react";

type GamePhase = "menu" | "tutorial" | "countdown" | "playing" | "result" | "gameover" | "leaderboard" | "settings";
type RoundType = "tap" | "wait";
type RoundResult = "success" | "fail" | null;
type Difficulty = "easy" | "normal" | "hard";
type GameMode = "classic" | "endless";
type TutorialStep = 0 | 1 | 2 | 3 | 4;
type PowerUpType = "time_freeze" | "double_points" | "extra_life";

interface GameSettings {
  sound: boolean;
  haptics: boolean;
  scanlineIntensity: number; // 0-100 (0 = off)
}

const DEFAULT_SETTINGS: GameSettings = { sound: true, haptics: true, scanlineIntensity: 60 };

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

function pickWeighted<K extends string>(weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[0][0];
}

const POWER_UP_CONFIG: Record<PowerUpType, { label: string; icon: string; color: string; desc: string; duration: number }> = {
  time_freeze: { label: "TIME FREEZE", icon: "❄️", color: "hsl(200 100% 70%)", desc: "+50% time", duration: 3 },
  double_points: { label: "2× POINTS", icon: "⚡", color: "hsl(45 100% 55%)", desc: "Double score", duration: 3 },
  extra_life: { label: "EXTRA LIFE", icon: "💜", color: "hsl(320 100% 60%)", desc: "Survive 1 fail", duration: 1 },
};

const PROMPTS_TAP = ["TAP NOW!", "HIT IT!", "SMASH!", "GO GO GO!", "STRIKE!", "QUICK!"];
const PROMPTS_WAIT = ["WAIT...", "HOLD ON...", "PATIENCE...", "STAY STILL...", "DON'T MOVE...", "RESIST..."];
const FAKE_PROMPTS = ["TAP... NOT!", "NOW... WAIT", "RE—WAIT", "ALM—HOLD"];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

const TUTORIAL_STEPS = [
  { title: "WELCOME", desc: "This game tests your instincts.\nReact fast — but only when told to.", action: "NEXT" },
  { title: "TAP ROUNDS", desc: "When you see a CYAN circle,\nTAP anywhere as fast as you can!", action: "TAP TO PRACTICE", type: "tap" as const },
  { title: "WAIT ROUNDS", desc: "When you see a GOLD circle,\nDON'T TAP. Just wait it out.", action: "WAIT TO PRACTICE", type: "wait" as const },
  { title: "FAKE OUTS!", desc: "Watch out for tricky prompts!\nThey look like TAP but aren't.", action: "GOT IT" },
  { title: "READY?", desc: "Combos multiply your score.\nPower-ups appear randomly!\nOne wrong move = Game Over.", action: "START PLAYING" },
];

export default function TapOrWaitGame() {
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
  const [leaderboardTab, setLeaderboardTab] = useState<GameMode>("classic");
  const [playerName, setPlayerName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

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

  const showNotice = useCallback((text: string, ms = 1300) => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    setPowerUpNotice(text);
    noticeTimeoutRef.current = setTimeout(() => setPowerUpNotice(null), ms);
  }, []);

  const config = DIFFICULTY_CONFIG[difficulty];

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
  }, []);

  const spawnParticles = useCallback((color: string) => {
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
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 400);
  }, []);

  // Spawn power-up pickup
  const maybeSpawnPowerUp = useCallback(() => {
    const endless = mode === "endless";
    const cfg = endless ? ENDLESS_POWER_UP_WEIGHTS[difficulty] : null;
    const chance = endless ? cfg!.chance : config.powerUpChance;
    if (Math.random() > chance) return;

    const type: PowerUpType = endless
      ? pickWeighted<PowerUpType>(cfg!.weights)
      : getRandomItem(["time_freeze", "double_points", "extra_life"] as PowerUpType[]);

    const pickup: PowerUpPickup = {
      type, id: pickupIdRef.current++,
      x: 15 + Math.random() * 70,
      y: 15 + Math.random() * 50,
    };
    setPowerUpPickups(prev => [...prev, pickup]);
    // Brief on-screen description when it appears
    const pcfg = POWER_UP_CONFIG[type];
    showNotice(`${pcfg.icon} ${pcfg.label} — ${pcfg.desc}`);
    // Auto-remove after 3 seconds if not collected
    setTimeout(() => {
      setPowerUpPickups(prev => prev.filter(p => p.id !== pickup.id));
    }, 3000);
  }, [config.powerUpChance, mode, difficulty, showNotice]);

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
    setPhase("countdown"); setCountdown(3);
  };

  // Survival timer ticker (endless mode)
  useEffect(() => {
    if (mode !== "endless") return;
    if (phase !== "playing" && phase !== "result") return;
    const id = setInterval(() => {
      const ms = Date.now() - survivalStartRef.current;
      survivalMsRef.current = ms;
      setSurvivalMs(ms);
    }, 100);
    return () => clearInterval(id);
  }, [mode, phase]);

  // Persist & sync settings
  useEffect(() => {
    currentSettings = settings;
    localStorage.setItem("tapOrWait_settings", JSON.stringify(settings));
  }, [settings]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { startRound(0); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const startRound = useCallback((currentRound: number) => {
    clearAllTimers();
    setTapped(false); setRoundResult(null); setShowFake(false); setComboFlash(false);

    const type: RoundType = Math.random() > 0.45 ? "tap" : "wait";
    setRoundType(type);

    const time = getMaxTime(currentRound);

    // Maybe spawn a power-up
    if (currentRound > 1) maybeSpawnPowerUp();

    if (currentRound > config.fakeAfterRound && Math.random() < config.fakeChance) {
      setPrompt(getRandomItem(FAKE_PROMPTS));
      setShowFake(true);
      setPhase("playing");
      roundStartRef.current = Date.now();

      fakeTimerRef.current = setTimeout(() => {
        setShowFake(false);
        setPrompt(type === "tap" ? getRandomItem(PROMPTS_TAP) : getRandomItem(PROMPTS_WAIT));
        roundStartRef.current = Date.now();
        setTimeLeft(time);
        if (type === "tap") {
          timerRef.current = setTimeout(() => handleRoundEnd(false, currentRound), time);
        } else {
          waitTimerRef.current = setTimeout(() => handleRoundEnd(true, currentRound), time);
        }
      }, 600 + Math.random() * 800);
    } else {
      setPrompt(type === "tap" ? getRandomItem(PROMPTS_TAP) : getRandomItem(PROMPTS_WAIT));
      setPhase("playing");
      roundStartRef.current = Date.now();
      setTimeLeft(time);
      if (type === "tap") {
        timerRef.current = setTimeout(() => handleRoundEnd(false, currentRound), time);
      } else {
        waitTimerRef.current = setTimeout(() => handleRoundEnd(true, currentRound), time);
      }
    }
  }, [clearAllTimers, config, getMaxTime, maybeSpawnPowerUp]);

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

      setTimeout(() => {
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

        setTimeout(() => {
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
        } else {
          if (isLeaderboardWorthy(prev)) setShowNameInput(true);
        }
        return prev;
      });
    }
  }, [clearAllTimers, highScore, startRound, maxCombo, triggerShake, spawnParticles, tickPowerUps, hasActivePowerUp, extraLives, mode, showNotice]);

  const handleTap = useCallback(() => {
    if (phase !== "playing" || tapped) return;
    setTapped(true); vibrate(15); playSound("tap");
    if (showFake) { handleRoundEnd(false, round); return; }
    if (roundType === "tap") handleRoundEnd(true, round);
    else handleRoundEnd(false, round);
  }, [phase, tapped, showFake, roundType, round, handleRoundEnd]);

  // Timer bar
  useEffect(() => {
    if (phase !== "playing" || showFake) return;
    const curMaxTime = getMaxTime(round);
    const interval = setInterval(() => {
      const elapsed = Date.now() - roundStartRef.current;
      const remaining = Math.max(0, curMaxTime - elapsed);
      setTimeLeft(remaining);
    }, 30);
    return () => clearInterval(interval);
  }, [phase, showFake, round, getMaxTime]);

  useEffect(() => {
    if (phase === "gameover" && score > highScore) {
      setHighScore(score);
      localStorage.setItem("tapOrWait_highScore", score.toString());
    }
  }, [phase, score, highScore]);

  // Tutorial wait practice
  useEffect(() => {
    if (phase === "tutorial" && tutorialStep === 2 && !tutorialWaitDone) {
      const t = setTimeout(() => {
        setTutorialWaitDone(true); playSound("success"); vibrate(30);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [phase, tutorialStep, tutorialWaitDone]);

  // Particle animation
  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev =>
        prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.05, vy: p.vy + 0.1 })).filter(p => p.life > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, [particles.length]);

  const handleSaveScore = () => {
    const name = playerName.trim() || "ANON";
    const updated = saveToLeaderboard({
      name: name.toUpperCase().slice(0, 10), score, difficulty, maxCombo,
      date: new Date().toLocaleDateString(),
    });
    setLeaderboard(updated); setShowNameInput(false);
  };

  const timerPercent = maxTime > 0 ? (timeLeft / maxTime) * 100 : 0;
  const comboMultiplier = Math.min(1 + (combo - 1) * 0.25, 4);

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden transition-transform duration-75 ${screenShake ? "animate-shake" : ""}`}
      onPointerDown={phase === "playing" ? handleTap : undefined}
    >
      {/* Retro grid background */}
      <div className="retro-grid" />
      {/* Scanline overlay */}
      {settings.scanlines && <div className="scanlines" />}
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
      {powerUpPickups.map(pickup => (
        <div
          key={pickup.id}
          className="absolute z-30 cursor-pointer animate-pulse-ring"
          style={{ left: `${pickup.x}%`, top: `${pickup.y}%` }}
          onPointerDown={(e) => { e.stopPropagation(); collectPowerUp(pickup); }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 backdrop-blur-sm"
            style={{
              backgroundColor: `${POWER_UP_CONFIG[pickup.type].color.replace(")", " / 0.2)")}`,
              borderColor: POWER_UP_CONFIG[pickup.type].color,
              boxShadow: `0 0 15px ${POWER_UP_CONFIG[pickup.type].color}, 0 0 30px ${POWER_UP_CONFIG[pickup.type].color.replace(")", " / 0.3)")}`,
            }}
          >
            {POWER_UP_CONFIG[pickup.type].icon}
          </div>
        </div>
      ))}

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
        <div className="flex flex-col items-center gap-6 z-10 px-6">
          <h1 className="font-display font-black text-5xl md:text-7xl text-primary text-glow-cyan tracking-wider">
            TAP
          </h1>
          <div className="font-display text-2xl md:text-3xl text-secondary text-glow-magenta">
            or WAIT
          </div>
          <p className="text-muted-foreground text-center text-sm max-w-xs leading-relaxed mt-1">
            React to prompts. Tap when told. Wait when warned. Collect power-ups. One wrong move and it's over.
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
            {(["classic", "endless"] as GameMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg font-display text-xs font-bold transition-all ${
                  mode === m
                    ? "bg-secondary/20 text-secondary border border-secondary/50 glow-magenta"
                    : "bg-muted text-muted-foreground border border-border hover:border-foreground/30"
                }`}
              >
                {m === "classic" ? "CLASSIC" : "ENDLESS"}
              </button>
            ))}
          </div>

          <button
            onClick={startGame}
            className="mt-2 px-10 py-4 bg-primary text-primary-foreground font-display font-bold text-lg rounded-xl glow-cyan hover:scale-105 active:scale-95 transition-transform"
          >
            PLAY
          </button>

          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => { setTutorialStep(0); setTutorialTapped(false); setTutorialWaitDone(false); setPhase("tutorial"); }}
              className="px-5 py-2 font-display text-xs text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/10 transition-colors"
            >
              TUTORIAL
            </button>
            <button
              onClick={() => { setLeaderboard(getLeaderboard()); setPhase("leaderboard"); }}
              className="px-5 py-2 font-display text-xs text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
            >
              LEADERBOARD
            </button>
            <button
              onClick={() => setPhase("settings")}
              className="px-5 py-2 font-display text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
            >
              SETTINGS
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
            STEP {tutorialStep + 1} / {TUTORIAL_STEPS.length}
          </div>
          <h2 className="font-display font-bold text-3xl text-primary text-glow-cyan">
            {TUTORIAL_STEPS[tutorialStep].title}
          </h2>
          <p className="text-foreground/80 text-center text-sm leading-relaxed whitespace-pre-line">
            {TUTORIAL_STEPS[tutorialStep].desc}
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
            {TUTORIAL_STEPS[tutorialStep].action}
          </button>

          <button
            onClick={() => setPhase("menu")}
            className="font-display text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            SKIP
          </button>
        </div>
      )}

      {/* COUNTDOWN */}
      {phase === "countdown" && (
        <div className="flex items-center justify-center z-10">
          <span key={countdown} className="font-display font-black text-8xl text-primary text-glow-cyan animate-countdown-pulse">
            {countdown || "GO!"}
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
              <p className="text-primary/60 text-xs font-display">TAP ANYWHERE</p>
            </>
          ) : (
            <>
              <div className="w-40 h-40 md:w-52 md:h-52 rounded-full bg-accent/10 border-2 border-accent flex items-center justify-center glow-gold">
                <span className="font-display font-black text-2xl md:text-3xl text-accent text-glow-gold text-center">
                  {prompt}
                </span>
              </div>
              <p className="text-accent/60 text-xs font-display">DON'T TAP</p>
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
            GAME OVER
          </div>
          <div className="flex flex-col items-center gap-2 mt-3">
            <span className="text-muted-foreground text-sm font-display">SCORE</span>
            <span className="font-display font-bold text-3xl text-foreground">{score}</span>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground text-xs font-display">BEST</span>
              <span className="font-display text-accent text-glow-gold text-lg">{highScore}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground text-xs font-display">MAX COMBO</span>
              <span className="font-display text-secondary text-glow-magenta text-lg">{maxCombo}x</span>
            </div>
          </div>
          <div className="text-muted-foreground text-xs mt-1">
            Survived {round} round{round !== 1 ? "s" : ""} on {config.label}
            {mode === "endless" && ` • ${(survivalMs / 1000).toFixed(1)}s ENDLESS`}
          </div>

          {showNameInput && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <span className="font-display text-xs text-primary text-glow-cyan">NEW HIGH SCORE! ENTER NAME:</span>
              <div className="flex gap-2">
                <input
                  type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
                  maxLength={10} placeholder="YOUR NAME"
                  className="px-3 py-2 bg-card border border-border rounded-lg font-display text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-32 text-center uppercase"
                  autoFocus onKeyDown={e => e.key === "Enter" && handleSaveScore()}
                />
                <button onClick={handleSaveScore}
                  className="px-4 py-2 bg-primary text-primary-foreground font-display text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-transform">
                  SAVE
                </button>
              </div>
            </div>
          )}

          <button onClick={startGame}
            className="mt-3 px-10 py-4 bg-primary text-primary-foreground font-display font-bold text-lg rounded-xl glow-cyan hover:scale-105 active:scale-95 transition-transform">
            RETRY
          </button>
          <button onClick={() => setPhase("menu")}
            className="px-6 py-2 font-display text-xs text-muted-foreground hover:text-foreground transition-colors">
            MENU
          </button>
        </div>
      )}

      {/* LEADERBOARD */}
      {phase === "leaderboard" && (
        <div className="flex flex-col items-center gap-4 z-10 px-6 max-w-sm w-full">
          <h2 className="font-display font-bold text-3xl text-accent text-glow-gold">
            LEADERBOARD
          </h2>
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm font-display mt-4">No scores yet. Play to get on the board!</p>
          ) : (
            <div className="w-full flex flex-col gap-1 mt-2">
              <div className="flex items-center gap-2 px-3 py-1 text-muted-foreground font-display text-[10px] uppercase tracking-wider">
                <span className="w-6">#</span>
                <span className="flex-1">NAME</span>
                <span className="w-16 text-right">SCORE</span>
                <span className="w-12 text-right">COMBO</span>
                <span className="w-12 text-right">DIFF</span>
              </div>
              {leaderboard.map((entry, i) => (
                <div key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-display text-xs ${
                    i === 0 ? "bg-accent/10 border border-accent/30 text-accent"
                    : i === 1 ? "bg-foreground/5 border border-foreground/10 text-foreground/80"
                    : i === 2 ? "bg-secondary/5 border border-secondary/10 text-secondary/80"
                    : "bg-card/50 text-muted-foreground"
                  }`}>
                  <span className="w-6 font-bold">{i + 1}</span>
                  <span className="flex-1 truncate">{entry.name}</span>
                  <span className="w-16 text-right font-bold">{entry.score}</span>
                  <span className="w-12 text-right">{entry.maxCombo}x</span>
                  <span className="w-12 text-right text-[10px]">{DIFFICULTY_CONFIG[entry.difficulty]?.label || "?"}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setPhase("menu")}
            className="mt-4 px-8 py-3 bg-card text-foreground font-display font-bold text-sm rounded-xl border border-border hover:border-primary/50 hover:scale-105 active:scale-95 transition-all">
            BACK
          </button>
        </div>
      )}

      {/* SETTINGS */}
      {phase === "settings" && (
        <div className="flex flex-col items-center gap-5 z-10 px-6 max-w-sm w-full">
          <h2 className="font-display font-bold text-3xl text-primary text-glow-cyan">
            SETTINGS
          </h2>
          <div className="w-full flex flex-col gap-3 mt-2">
            {([
              { key: "sound", label: "🔊 SOUND EFFECTS", desc: "Synth tones on actions" },
              { key: "haptics", label: "📳 HAPTIC FEEDBACK", desc: "Vibrate on tap & events" },
              { key: "scanlines", label: "📺 SCANLINE EFFECT", desc: "Retro CRT overlay" },
            ] as { key: keyof GameSettings; label: string; desc: string }[]).map(item => (
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
          </div>
          <button onClick={() => setPhase("menu")}
            className="mt-4 px-8 py-3 bg-card text-foreground font-display font-bold text-sm rounded-xl border border-border hover:border-primary/50 hover:scale-105 active:scale-95 transition-all">
            BACK
          </button>
        </div>
      )}
    </div>
  );
}
