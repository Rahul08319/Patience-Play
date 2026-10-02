// Universal Web Audio Music & Sound Engine for Patience Play
// Zero external asset dependencies, 100% offline, CSP compliant, YouTube Playables certified.

type SoundType = "success" | "fail" | "tap" | "combo" | "powerup" | "countdown" | "countdown_go";
type MusicTheme = "menu" | "gameplay" | "gameover" | "silent";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private isMusicEnabled = true;
  private isSoundEnabled = true;
  private isPlatformMuted = false;
  private isGamePaused = false;
  private isAccessibleCues = false;

  private currentTheme: MusicTheme = "silent";
  private musicTimer: number | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private tempo = 124; // BPM for gameplay, 104 for menu
  private isUnlocked = false;

  // Melody & chord progressions
  // A minor -> F major -> C major -> G major (classic synthwave driving progression)
  private readonly bassProgression = [
    // Bar 1: A minor (A1: 55Hz, A2: 110Hz)
    [55, 110, 55, 110, 55, 110, 55, 110],
    // Bar 2: F major (F1: 43.65Hz, F2: 87.31Hz)
    [43.65, 87.31, 43.65, 87.31, 43.65, 87.31, 43.65, 87.31],
    // Bar 3: C major (C2: 65.41Hz, C3: 130.81Hz)
    [65.41, 130.81, 65.41, 130.81, 65.41, 130.81, 65.41, 130.81],
    // Bar 4: G major (G1: 49Hz, G2: 98Hz)
    [49, 98, 49, 98, 49, 98, 49, 98],
  ];

  // Lead arpeggio frequencies (A minor pentatonic)
  private readonly leadProgression = [
    // Bar 1 (Am): A3, C4, E4, A4, G4, E4, C4, B3
    [220, 261.63, 329.63, 440, 392, 329.63, 261.63, 246.94],
    // Bar 2 (F): F3, A3, C4, F4, E4, C4, A3, G3
    [174.61, 220, 261.63, 349.23, 329.63, 261.63, 220, 196],
    // Bar 3 (C): C3, E3, G3, C4, D4, C4, G3, E3
    [130.81, 164.81, 196, 261.63, 293.66, 261.63, 196, 164.81],
    // Bar 4 (G): G3, B3, D4, G4, F4, D4, B3, A3
    [196, 246.94, 293.66, 392, 349.23, 293.66, 246.94, 220],
  ];

  // Ambient menu pad chords: [Am, F, C, Em]
  private readonly menuChords = [
    [220, 261.63, 329.63], // Am
    [174.61, 220, 261.63], // F
    [261.63, 329.63, 392], // C
    [164.81, 196, 246.94], // Em
  ];

  constructor() {
    if (typeof window !== "undefined") {
      this.attachUnlockListeners();
    }
  }

  private attachUnlockListeners() {
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      this.isUnlocked = true;
      if (this.currentTheme !== "silent" && !this.musicTimer) {
        this.startMusicLoop();
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("click", unlock);
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("click", unlock, { passive: true });
  }

  private ensureContext(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return false;
        this.ctx = new AudioContextClass();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(this.isMusicEnabled ? 0.38 : 0, this.ctx.currentTime);
        this.musicGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.isSoundEnabled ? 0.65 : 0, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);
      } catch {
        return false;
      }
    }
    return true;
  }

  public unlock(): void {
    if (this.ensureContext() && this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
      this.isUnlocked = true;
    }
  }

  // --- Configuration & Platform Handlers ---

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(enabled ? 0.65 : 0, this.ctx.currentTime);
    }
  }

  public setMusicEnabled(enabled: boolean) {
    this.isMusicEnabled = enabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(enabled ? 0.38 : 0, this.ctx.currentTime, 0.08);
    }
    if (!enabled && this.musicTimer) {
      this.stopMusicLoop();
    } else if (enabled && this.currentTheme !== "silent" && !this.musicTimer) {
      this.startMusicLoop();
    }
  }

  public setPlatformMuted(muted: boolean) {
    this.isPlatformMuted = muted;
    this.updateMasterVolume();
  }

  public setGamePaused(paused: boolean) {
    this.isGamePaused = paused;
    this.updateMasterVolume();
  }

  public setAccessibleCues(enabled: boolean) {
    this.isAccessibleCues = enabled;
  }

  private updateMasterVolume() {
    if (!this.masterGain || !this.ctx) return;
    const shouldMute = this.isPlatformMuted || this.isGamePaused;
    const targetGain = shouldMute ? 0.0 : 1.0;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
  }

  // --- Music Synthesizer Engine ---

  public playTheme(theme: MusicTheme) {
    if (this.currentTheme === theme && this.musicTimer) return;
    this.currentTheme = theme;
    this.step = 0;

    if (!this.isMusicEnabled || theme === "silent") {
      this.stopMusicLoop();
      return;
    }

    this.ensureContext();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    this.tempo = theme === "menu" ? 104 : 124;
    this.startMusicLoop();
  }

  private startMusicLoop() {
    this.stopMusicLoop();
    if (!this.ensureContext() || !this.ctx) return;

    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.musicTimer = window.setInterval(() => {
      this.scheduleMusic();
    }, 45);
  }

  private stopMusicLoop() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic() {
    if (!this.ctx || !this.isMusicEnabled || this.currentTheme === "silent") return;

    const secondsPerBeat = 60.0 / this.tempo;
    const stepDuration = secondsPerBeat / 2; // Eighth note resolution

    while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
      if (this.currentTheme === "gameplay") {
        this.renderGameplayStep(this.nextNoteTime, this.step);
      } else if (this.currentTheme === "menu") {
        this.renderMenuStep(this.nextNoteTime, this.step);
      }
      this.nextNoteTime += stepDuration;
      this.step = (this.step + 1) % 32; // 4 bars of 8 eighth-notes = 32 steps
    }
  }

  private renderGameplayStep(time: number, step: number) {
    if (!this.ctx || !this.musicGain) return;

    const bar = Math.floor(step / 8);
    const subStep = step % 8;

    // 1. Kick Drum: on beats 0, 4 (and occasionally 6 for groove)
    if (subStep === 0 || subStep === 4) {
      this.synthesizeDrumKick(time);
    }

    // 2. Snare / Clap: on beats 2, 6 (backbeat)
    if (subStep === 2 || subStep === 6) {
      this.synthesizeDrumSnare(time);
    }

    // 3. Hi-Hat: on all off-beats
    if (subStep % 2 === 1) {
      this.synthesizeDrumHiHat(time, subStep === 3 || subStep === 7);
    }

    // 4. Bassline: Rolling 8th-note synth bass
    const bassNotes = this.bassProgression[bar];
    const bassFreq = bassNotes[subStep % bassNotes.length];
    this.synthesizeSynthBass(time, bassFreq, 0.22);

    // 5. Lead Arpeggio: Shimmering synth lead
    const leadNotes = this.leadProgression[bar];
    const leadFreq = leadNotes[subStep % leadNotes.length];
    // Vary lead pattern across odd/even bars
    if (bar % 2 === 0 || subStep % 2 === 0) {
      this.synthesizeSynthLead(time, leadFreq, 0.18);
    }
  }

  private renderMenuStep(time: number, step: number) {
    if (!this.ctx || !this.musicGain) return;

    const bar = Math.floor(step / 8);
    const subStep = step % 8;

    // Ambient chords every 8 steps (start of each bar)
    if (subStep === 0) {
      const chord = this.menuChords[bar];
      for (const freq of chord) {
        this.synthesizeWarmPad(time, freq, 1.8);
      }
    }

    // Subtle relaxing sub-bass on 0 and 4
    if (subStep === 0 || subStep === 4) {
      const bassFreq = this.bassProgression[bar][0];
      this.synthesizeSynthBass(time, bassFreq, 0.45, 0.16);
    }

    // Soft hi-hat tick every quarter beat
    if (subStep % 2 === 0) {
      this.synthesizeDrumHiHat(time, false, 0.03);
    }
  }

  // --- Web Audio Instrument Synthesizers ---

  private synthesizeDrumKick(time: number) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(36, time + 0.09);

      gain.gain.setValueAtTime(0.42, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + 0.15);
    } catch {}
  }

  private synthesizeDrumSnare(time: number) {
    if (!this.ctx || !this.musicGain) return;
    try {
      // Noise component
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(800, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + 0.09);
    } catch {}
  }

  private synthesizeDrumHiHat(time: number, open = false, vol = 0.08) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const bufferSize = this.ctx.sampleRate * (open ? 0.06 : 0.03);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(6500, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.06 : 0.03));

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + (open ? 0.065 : 0.035));
    } catch {}
  }

  private synthesizeSynthBass(time: number, freq: number, duration = 0.2, volume = 0.22) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, time);
      filter.frequency.exponentialRampToValueAtTime(180, time + duration);

      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch {}
  }

  private synthesizeSynthLead(time: number, freq: number, duration = 0.16) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, time);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, time);
      filter.frequency.exponentialRampToValueAtTime(600, time + duration);

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch {}
  }

  private synthesizeWarmPad(time: number, freq: number, duration = 1.6) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.09, time + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch {}
  }

  // --- Sound Effects (SFX) ---

  public playSound(type: SoundType) {
    if (!this.isSoundEnabled || this.isPlatformMuted || this.isGamePaused) return;
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;

    if (this.isAccessibleCues) {
      this.playAccessibleCue(type, now);
      return;
    }

    try {
      switch (type) {
        case "tap":
          this.playTapSound(now);
          break;
        case "success":
          this.playSuccessSound(now);
          break;
        case "fail":
          this.playFailSound(now);
          break;
        case "combo":
          this.playComboSound(now);
          break;
        case "powerup":
          this.playPowerupSound(now);
          break;
        case "countdown":
          this.playCountdownSound(now);
          break;
        case "countdown_go":
          this.playCountdownGoSound(now);
          break;
      }
    } catch {}
  }

  private playTapSound(now: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  private playSuccessSound(now: number) {
    if (!this.ctx || !this.sfxGain) return;
    // Major chord chime: C5 -> E5 -> G5
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.18, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.29);
    });
  }

  private playFailSound(now: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.38);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.39);
  }

  private playComboSound(now: number) {
    if (!this.ctx || !this.sfxGain) return;
    const notes = [784, 988, 1175, 1568];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.18, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.23);
    });
  }

  private playPowerupSound(now: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.22);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.29);
  }

  private playCountdownSound(now: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  private playCountdownGoSound(now: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  private playAccessibleCue(type: SoundType, now: number) {
    if (!this.ctx || !this.sfxGain) return;
    const tones: Record<SoundType, number> = {
      success: 740,
      fail: 180,
      tap: 960,
      combo: 1120,
      powerup: 640,
      countdown: 440,
      countdown_go: 880,
    };
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type === "fail" ? "square" : "sine";
    osc.frequency.setValueAtTime(tones[type] || 500, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }
}

export const soundEngine = new SoundEngine();
