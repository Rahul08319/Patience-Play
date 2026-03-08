import { useState, useEffect, useCallback, useRef } from "react";

type GamePhase = "menu" | "countdown" | "playing" | "result" | "gameover";
type RoundType = "tap" | "wait";
type RoundResult = "success" | "fail" | null;
type Difficulty = "easy" | "normal" | "hard";

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; baseTime: number; minTime: number; decay: number; fakeAfterRound: number; fakeChance: number }> = {
  easy: { label: "EASY", baseTime: 3000, minTime: 1200, decay: 60, fakeAfterRound: 5, fakeChance: 0.3 },
  normal: { label: "NORMAL", baseTime: 2000, minTime: 800, decay: 80, fakeAfterRound: 3, fakeChance: 0.5 },
  hard: { label: "HARD", baseTime: 1400, minTime: 500, decay: 100, fakeAfterRound: 1, fakeChance: 0.7 },
};

const PROMPTS_TAP = ["TAP NOW!", "HIT IT!", "SMASH!", "GO GO GO!", "STRIKE!", "QUICK!"];
const PROMPTS_WAIT = ["WAIT...", "HOLD ON...", "PATIENCE...", "STAY STILL...", "DON'T MOVE...", "RESIST..."];
const FAKE_PROMPTS = ["TAP... NOT!", "NOW... WAIT", "RE—WAIT", "ALM—HOLD"];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Haptic feedback helper
function vibrate(pattern: number | number[]) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// Audio synthesis for sound effects
function playSound(type: "success" | "fail" | "tap" | "combo") {
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
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
        break;
      case "fail":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        break;
      case "tap":
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.06);
        break;
      case "combo":
        osc.type = "sine";
        osc.frequency.setValueAtTime(784, ctx.currentTime);
        osc.frequency.setValueAtTime(988, ctx.currentTime + 0.06);
        osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
        break;
    }
  } catch {}
}

export default function TapOrWaitGame() {
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem("tapOrWait_highScore") || "0");
  });
  const [roundType, setRoundType] = useState<RoundType>("tap");
  const [prompt, setPrompt] = useState("");
  const [roundResult, setRoundResult] = useState<RoundResult>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [tapped, setTapped] = useState(false);
  const [showFake, setShowFake] = useState(false);
  const [lastPoints, setLastPoints] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fakeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartRef = useRef(0);

  const config = DIFFICULTY_CONFIG[difficulty];
  const maxTime = Math.max(config.baseTime - round * config.decay, config.minTime);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    if (fakeTimerRef.current) clearTimeout(fakeTimerRef.current);
  }, []);

  const startGame = () => {
    setScore(0);
    setRound(0);
    setCombo(0);
    setMaxCombo(0);
    setPhase("countdown");
    setCountdown(3);
  };

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      startRound(0);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const startRound = useCallback((currentRound: number) => {
    clearAllTimers();
    setTapped(false);
    setRoundResult(null);
    setShowFake(false);
    setComboFlash(false);

    const type: RoundType = Math.random() > 0.45 ? "tap" : "wait";
    setRoundType(type);

    const time = Math.max(config.baseTime - currentRound * config.decay, config.minTime);

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
  }, [clearAllTimers, config]);

  const handleRoundEnd = useCallback((success: boolean, currentRound: number) => {
    clearAllTimers();
    if (success) {
      const reaction = Date.now() - roundStartRef.current;
      const bonus = Math.max(0, Math.floor((2000 - reaction) / 10));
      
      setCombo(prev => {
        const newCombo = prev + 1;
        const multiplier = Math.min(1 + (newCombo - 1) * 0.25, 4); // max 4x
        const points = Math.floor((100 + bonus) * multiplier);
        setLastPoints(points);
        setScore(s => s + points);
        
        if (newCombo > 1) {
          setComboFlash(true);
          if (newCombo >= 5) playSound("combo");
          else playSound("success");
        } else {
          playSound("success");
        }
        
        if (newCombo > maxCombo) setMaxCombo(newCombo);
        return newCombo;
      });
      
      vibrate(30);
      setRoundResult("success");
      setPhase("result");

      setTimeout(() => {
        const nextRound = currentRound + 1;
        setRound(nextRound);
        startRound(nextRound);
      }, 800);
    } else {
      playSound("fail");
      vibrate([50, 30, 50, 30, 80]);
      setCombo(0);
      setRoundResult("fail");
      setPhase("gameover");
      setScore(prev => {
        if (prev > highScore) {
          setHighScore(prev);
          localStorage.setItem("tapOrWait_highScore", prev.toString());
        }
        return prev;
      });
    }
  }, [clearAllTimers, highScore, startRound, maxCombo]);

  const handleTap = useCallback(() => {
    if (phase !== "playing" || tapped) return;
    setTapped(true);
    vibrate(15);
    playSound("tap");

    if (showFake) {
      handleRoundEnd(false, round);
      return;
    }

    if (roundType === "tap") {
      handleRoundEnd(true, round);
    } else {
      handleRoundEnd(false, round);
    }
  }, [phase, tapped, showFake, roundType, round, handleRoundEnd]);

  // Timer bar
  useEffect(() => {
    if (phase !== "playing" || showFake) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - roundStartRef.current;
      const remaining = Math.max(0, maxTime - elapsed);
      setTimeLeft(remaining);
    }, 30);
    return () => clearInterval(interval);
  }, [phase, showFake, maxTime]);

  useEffect(() => {
    if (phase === "gameover" && score > highScore) {
      setHighScore(score);
      localStorage.setItem("tapOrWait_highScore", score.toString());
    }
  }, [phase, score, highScore]);

  const timerPercent = maxTime > 0 ? (timeLeft / maxTime) * 100 : 0;
  const comboMultiplier = Math.min(1 + (combo - 1) * 0.25, 4);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden"
      onPointerDown={phase === "playing" ? handleTap : undefined}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] transition-colors duration-300"
          style={{
            backgroundColor:
              phase === "playing" && !showFake
                ? roundType === "tap"
                  ? "hsl(174 100% 50%)"
                  : "hsl(45 100% 55%)"
                : phase === "gameover"
                ? "hsl(0 85% 55%)"
                : "hsl(320 100% 60%)",
          }}
        />
      </div>

      {/* Header */}
      {phase !== "menu" && (
        <div className="absolute top-6 left-0 right-0 flex justify-between items-start px-6 z-10">
          <div className="flex flex-col gap-1">
            <div className="font-display text-sm text-muted-foreground">
              RD <span className="text-foreground">{round + 1}</span>
            </div>
            <div className="font-display text-[10px] text-muted-foreground uppercase tracking-wider">
              {config.label}
            </div>
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
                timerPercent > 50
                  ? "hsl(174 100% 50%)"
                  : timerPercent > 25
                  ? "hsl(45 100% 55%)"
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
            React to prompts. Tap when told. Wait when warned. One wrong move and it's over.
          </p>

          {/* Difficulty selector */}
          <div className="flex gap-2 mt-2">
            {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-4 py-2 rounded-lg font-display text-xs font-bold transition-all ${
                  difficulty === d
                    ? d === "easy"
                      ? "bg-game-success/20 text-game-success border border-game-success/50"
                      : d === "normal"
                      ? "bg-primary/20 text-primary border border-primary/50 glow-cyan"
                      : "bg-destructive/20 text-destructive border border-destructive/50"
                    : "bg-muted text-muted-foreground border border-border hover:border-foreground/30"
                }`}
              >
                {DIFFICULTY_CONFIG[d].label}
              </button>
            ))}
          </div>

          <button
            onClick={startGame}
            className="mt-4 px-10 py-4 bg-primary text-primary-foreground font-display font-bold text-lg rounded-xl glow-cyan hover:scale-105 active:scale-95 transition-transform"
          >
            PLAY
          </button>
          {highScore > 0 && (
            <div className="text-accent font-display text-sm text-glow-gold">
              BEST: {highScore}
            </div>
          )}
        </div>
      )}

      {/* COUNTDOWN */}
      {phase === "countdown" && (
        <div className="flex items-center justify-center z-10">
          <span
            key={countdown}
            className="font-display font-black text-8xl text-primary text-glow-cyan animate-countdown-pulse"
          >
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
              +{lastPoints}
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
        <div className="flex flex-col items-center gap-5 z-10 px-6 animate-shake">
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
          </div>
          <button
            onClick={startGame}
            className="mt-3 px-10 py-4 bg-primary text-primary-foreground font-display font-bold text-lg rounded-xl glow-cyan hover:scale-105 active:scale-95 transition-transform"
          >
            RETRY
          </button>
          <button
            onClick={() => setPhase("menu")}
            className="px-6 py-2 font-display text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            MENU
          </button>
        </div>
      )}
    </div>
  );
}
