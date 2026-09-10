export type SupportedLanguage = "en" | "es" | "hi";

type Copy = {
  title: string;
  subtitle: string;
  intro: string;
  classic: string;
  endless: string;
  daily: string;
  play: string;
  tutorial: string;
  leaderboard: string;
  settings: string;
  back: string;
  retry: string;
  menu: string;
  gameOver: string;
  score: string;
  best: string;
  maxCombo: string;
  tapAnywhere: string;
  doNotTap: string;
  paused: string;
  loading: string;
  round: string;
  newHighScore: string;
  yourName: string;
  save: string;
  noScores: string;
  playToRank: string;
  sound: string;
  haptics: string;
  reducedMotion: string;
  highContrast: string;
  accessibleCues: string;
  scanlines: string;
  auto: string;
};

const COPY: Record<SupportedLanguage, Copy> = {
  en: {
    title: "TAP", subtitle: "or WAIT", intro: "React to prompts. Tap when told. Wait when warned. Collect power-ups. One wrong move and it's over.",
    classic: "CLASSIC", endless: "ENDLESS", daily: "DAILY", play: "PLAY", tutorial: "TUTORIAL", leaderboard: "LEADERBOARD", settings: "SETTINGS", back: "BACK", retry: "RETRY", menu: "MENU",
    gameOver: "GAME OVER", score: "SCORE", best: "BEST", maxCombo: "MAX COMBO", tapAnywhere: "TAP ANYWHERE", doNotTap: "DON'T TAP", paused: "PAUSED", loading: "LOADING...", round: "RD",
    newHighScore: "NEW HIGH SCORE! ENTER NAME:", yourName: "YOUR NAME", save: "SAVE", noScores: "No scores yet.", playToRank: "Play to get on the board!",
    sound: "SOUND EFFECTS", haptics: "HAPTIC FEEDBACK", reducedMotion: "REDUCED MOTION", highContrast: "HIGH CONTRAST", accessibleCues: "ACCESSIBLE SOUND CUES", scanlines: "SCANLINE INTENSITY", auto: "AUTO",
  },
  es: {
    title: "TOCA", subtitle: "o ESPERA", intro: "Reacciona a las señales. Toca cuando se indique. Espera cuando se advierta. Recoge potenciadores. Un error termina la partida.",
    classic: "CLÁSICO", endless: "INFINITO", daily: "DIARIO", play: "JUGAR", tutorial: "TUTORIAL", leaderboard: "CLASIFICACIÓN", settings: "AJUSTES", back: "VOLVER", retry: "REINTENTAR", menu: "MENÚ",
    gameOver: "FIN DEL JUEGO", score: "PUNTOS", best: "MEJOR", maxCombo: "COMBO MÁX.", tapAnywhere: "TOCA EN CUALQUIER LUGAR", doNotTap: "NO TOQUES", paused: "PAUSA", loading: "CARGANDO...", round: "RONDA",
    newHighScore: "¡NUEVO RÉCORD! NOMBRE:", yourName: "TU NOMBRE", save: "GUARDAR", noScores: "Aún no hay puntuaciones.", playToRank: "¡Juega para entrar en la tabla!",
    sound: "EFECTOS DE SONIDO", haptics: "RESPUESTA HÁPTICA", reducedMotion: "MENOS MOVIMIENTO", highContrast: "ALTO CONTRASTE", accessibleCues: "SEÑALES DE SONIDO", scanlines: "INTENSIDAD DE LÍNEAS", auto: "AUTO",
  },
  hi: {
    title: "टैप", subtitle: "या रुकें", intro: "संकेतों पर प्रतिक्रिया दें। कहने पर टैप करें, चेतावनी पर रुकें। पावर-अप लें। एक गलत चाल और खेल खत्म।",
    classic: "क्लासिक", endless: "अंतहीन", daily: "दैनिक", play: "खेलें", tutorial: "ट्यूटोरियल", leaderboard: "लीडरबोर्ड", settings: "सेटिंग्स", back: "वापस", retry: "फिर खेलें", menu: "मेनू",
    gameOver: "खेल खत्म", score: "स्कोर", best: "सर्वश्रेष्ठ", maxCombo: "सबसे बड़ा कॉम्बो", tapAnywhere: "कहीं भी टैप करें", doNotTap: "टैप न करें", paused: "रुका हुआ", loading: "लोड हो रहा है...", round: "राउंड",
    newHighScore: "नया हाई स्कोर! नाम लिखें:", yourName: "आपका नाम", save: "सहेजें", noScores: "अभी कोई स्कोर नहीं।", playToRank: "बोर्ड पर आने के लिए खेलें!",
    sound: "साउंड इफेक्ट", haptics: "हैप्टिक फीडबैक", reducedMotion: "कम गति", highContrast: "हाई कॉन्ट्रास्ट", accessibleCues: "सुलभ ध्वनि संकेत", scanlines: "स्कैनलाइन तीव्रता", auto: "ऑटो",
  },
};

const PROMPTS: Record<SupportedLanguage, { tap: string[]; wait: string[]; fake: string[] }> = {
  en: { tap: ["TAP NOW!", "HIT IT!", "SMASH!", "GO GO GO!", "STRIKE!", "QUICK!"], wait: ["WAIT...", "HOLD ON...", "PATIENCE...", "STAY STILL...", "DON'T MOVE...", "RESIST..."], fake: ["TAP... NOT!", "NOW... WAIT", "RE—WAIT", "ALM—HOLD"] },
  es: { tap: ["¡TOCA YA!", "¡AHORA!", "¡DALE!", "¡RÁPIDO!"], wait: ["ESPERA...", "QUIETO...", "PACIENCIA...", "NO TE MUEVAS..."], fake: ["TOCA... ¡NO!", "AHORA... ESPERA", "CASI... QUIETO"] },
  hi: { tap: ["अभी टैप करें!", "जल्दी!", "टैप करें!", "अब!"], wait: ["रुकें...", "ठहरें...", "धैर्य...", "हिलें नहीं..."], fake: ["टैप... नहीं!", "अब... रुकें", "लगभग... रुकें"] },
};

export function languageFromLocale(locale: string): SupportedLanguage {
  const base = locale.toLowerCase().split("-")[0];
  return base === "es" || base === "hi" ? base : "en";
}

export function getCopy(locale: string): Copy {
  return COPY[languageFromLocale(locale)];
}

export function getPrompts(locale: string) {
  return PROMPTS[languageFromLocale(locale)];
}

export function getTutorialSteps(locale: string) {
  const language = languageFromLocale(locale);
  if (language === "es") return [
    { title: "BIENVENIDO", desc: "Este juego pone a prueba tus instintos.\nReacciona rápido, solo cuando se indique.", action: "SIGUIENTE" },
    { title: "RONDA DE TOCAR", desc: "Cuando veas un círculo CIAN,\ntoca en cualquier lugar rápidamente.", action: "PRACTICAR", type: "tap" as const },
    { title: "RONDA DE ESPERAR", desc: "Cuando veas un círculo DORADO,\nno toques. Solo espera.", action: "PRACTICAR", type: "wait" as const },
    { title: "¡ENGAÑOS!", desc: "Cuidado con las señales tramposas.\nParecen pedir toque, pero no.", action: "ENTENDIDO" },
    { title: "¿LISTO?", desc: "Los combos multiplican tus puntos.\n¡Un error termina la partida!", action: "EMPEZAR" },
  ];
  if (language === "hi") return [
    { title: "स्वागत", desc: "यह खेल आपकी प्रतिक्रिया जांचता है।\nतेज रहें, पर सिर्फ कहने पर।", action: "आगे" },
    { title: "टैप राउंड", desc: "सायन गोला दिखे तो\nकहीं भी तुरंत टैप करें।", action: "अभ्यास", type: "tap" as const },
    { title: "रुकने का राउंड", desc: "सुनहरा गोला दिखे तो\nटैप न करें। बस रुकें।", action: "अभ्यास", type: "wait" as const },
    { title: "धोखा!", desc: "भ्रामक संकेतों से सावधान रहें।\nवे टैप जैसे दिखते हैं, पर नहीं हैं।", action: "समझ गया" },
    { title: "तैयार?", desc: "कॉम्बो आपके अंक बढ़ाते हैं।\nएक गलती से खेल खत्म।", action: "शुरू करें" },
  ];
  return [
    { title: "WELCOME", desc: "This game tests your instincts.\nReact fast — but only when told to.", action: "NEXT" },
    { title: "TAP ROUNDS", desc: "When you see a CYAN circle,\nTAP anywhere as fast as you can!", action: "TAP TO PRACTICE", type: "tap" as const },
    { title: "WAIT ROUNDS", desc: "When you see a GOLD circle,\nDON'T TAP. Just wait it out.", action: "WAIT TO PRACTICE", type: "wait" as const },
    { title: "FAKE OUTS!", desc: "Watch out for tricky prompts!\nThey look like TAP but aren't.", action: "GOT IT" },
    { title: "READY?", desc: "Combos multiply your score.\nPower-ups appear randomly!\nOne wrong move = Game Over.", action: "START PLAYING" },
  ];
}
