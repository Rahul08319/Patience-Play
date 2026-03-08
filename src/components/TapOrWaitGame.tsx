import { useState, useEffect, useCallback, useRef } from "react";

type GamePhase = "menu" | "countdown" | "playing" | "result" | "gameover";
type RoundType = "tap" | "wait";
type RoundResult = "success" | "fail" | null;

const PROMPTS_TAP = [
  "TAP NOW!",
  "HIT IT!",
  "SMASH!",
  "GO GO GO!",
  "STRIKE!",
  "QUICK!",
];

const PROMPTS_WAIT = [
  "WAIT...",
  "HOLD ON...",
  "PATIENCE...",
  "STAY STILL...",
  "DON'T MOVE...",
  "RESIST...",
];

const FAKE_PROMPTS = [
  "TAP... NOT!",
  "NOW... WAIT",
  "RE—WAIT",
  "ALM—HOLD",
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function TapOrWaitGame() {
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fakeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartRef = useRef(0);

  const maxTime = Math.max(2000 - round * 80, 800);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    if (fakeTimerRef.current) clearTimeout(fakeTimerRef.current);
  }, []);

  const startGame = () => {
    setScore(0);
    setRound(0);
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

    const type: RoundType = Math.random() > 0.45 ? "tap" : "wait";
    setRoundType(type);

    // Sometimes show a fake prompt first (after round 3)
    if (currentRound > 3 && Math.random() > 0.6) {
      setPrompt(getRandomItem(FAKE_PROMPTS));
      setShowFake(true);
      setPhase("playing");
      roundStartRef.current = Date.now();

      fakeTimerRef.current = setTimeout(() => {
        setShowFake(false);
        setPrompt(type === "tap" ? getRandomItem(PROMPTS_TAP) : getRandomItem(PROMPTS_WAIT));
        roundStartRef.current = Date.now();
        
        const time = Math.max(2000 - currentRound * 80, 800);
        setTimeLeft(time);
        
        if (type === "tap") {
          timerRef.current = setTimeout(() => {
            handleRoundEnd(false, currentRound);
          }, time);
        } else {
          waitTimerRef.current = setTimeout(() => {
            handleRoundEnd(true, currentRound);
          }, time);
        }
      }, 600 + Math.random() * 800);
    } else {
      setPrompt(type === "tap" ? getRandomItem(PROMPTS_TAP) : getRandomItem(PROMPTS_WAIT));
      setPhase("playing");
      roundStartRef.current = Date.now();

      const time = Math.max(2000 - currentRound * 80, 800);
      setTimeLeft(time);

      if (type === "tap") {
        timerRef.current = setTimeout(() => {
          handleRoundEnd(false, currentRound);
        }, time);
      } else {
        waitTimerRef.current = setTimeout(() => {
          handleRoundEnd(true, currentRound);
        }, time);
      }
    }
  }, [clearAllTimers]);

  const handleRoundEnd = useCallback((success: boolean, currentRound: number) => {
    clearAllTimers();
    if (success) {
      const reaction = Date.now() - roundStartRef.current;
      const bonus = Math.max(0, Math.floor((2000 - reaction) / 10));
      const points = 100 + bonus;
      setScore(prev => prev + points);
      setRoundResult("success");
      setPhase("result");

      setTimeout(() => {
        const nextRound = currentRound + 1;
        setRound(nextRound);
        startRound(nextRound);
      }, 800);
    } else {
      setRoundResult("fail");
      setPhase("gameover");
      setScore(prev => {
        const finalScore = prev;
        if (finalScore > highScore) {
          setHighScore(finalScore);
          localStorage.setItem("tapOrWait_highScore", finalScore.toString());
        }
        return finalScore;
      });
    }
  }, [clearAllTimers, highScore, startRound]);

  const handleTap = useCallback(() => {
    if (phase !== "playing" || tapped) return;
    setTapped(true);

    if (showFake) {
      // Tapped during fake prompt = fail
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

  // Update high score on gameover
  useEffect(() => {
    if (phase === "gameover" && score > highScore) {
      setHighScore(score);
      localStorage.setItem("tapOrWait_highScore", score.toString());
    }
  }, [phase, score, highScore]);

  const timerPercent = maxTime > 0 ? (timeLeft / maxTime) * 100 : 0;

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

      {/* Header - Score */}
      {phase !== "menu" && (
        <div className="absolute top-6 left-0 right-0 flex justify-between px-6 z-10">
          <div className="font-display text-sm text-muted-foreground">
            RD <span className="text-foreground">{round + 1}</span>
          </div>
          <div className="font-display text-sm text-primary text-glow-cyan">
            {score}
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
        <div className="flex flex-col items-center gap-8 z-10 px-6">
          <h1 className="font-display font-black text-5xl md:text-7xl text-primary text-glow-cyan tracking-wider">
            TAP
          </h1>
          <div className="font-display text-2xl md:text-3xl text-secondary text-glow-magenta">
            or WAIT
          </div>
          <p className="text-muted-foreground text-center text-sm max-w-xs leading-relaxed mt-2">
            React to prompts. Tap when told. Wait when warned. One wrong move and it's over.
          </p>
          <button
            onClick={startGame}
            className="mt-6 px-10 py-4 bg-primary text-primary-foreground font-display font-bold text-lg rounded-xl glow-cyan hover:scale-105 active:scale-95 transition-transform"
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
        <div className="flex items-center justify-center z-10">
          <span className="font-display font-black text-5xl text-green-400 text-glow-cyan">
            ✓
          </span>
        </div>
      )}

      {/* GAME OVER */}
      {phase === "gameover" && (
        <div className="flex flex-col items-center gap-6 z-10 px-6 animate-shake">
          <div className="font-display font-black text-4xl md:text-6xl text-destructive" style={{ textShadow: "0 0 20px hsl(0 85% 55% / 0.8)" }}>
            GAME OVER
          </div>
          <div className="flex flex-col items-center gap-2 mt-4">
            <span className="text-muted-foreground text-sm font-display">SCORE</span>
            <span className="font-display font-bold text-3xl text-foreground">{score}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs font-display">BEST</span>
            <span className="font-display text-accent text-glow-gold text-lg">{highScore}</span>
          </div>
          <div className="text-muted-foreground text-xs mt-2">
            Survived {round} round{round !== 1 ? "s" : ""}
          </div>
          <button
            onClick={startGame}
            className="mt-4 px-10 py-4 bg-primary text-primary-foreground font-display font-bold text-lg rounded-xl glow-cyan hover:scale-105 active:scale-95 transition-transform"
          >
            RETRY
          </button>
        </div>
      )}
    </div>
  );
}
