/**
 * Voiceover: each slide's narration (written by the AI, editable) is spoken by Kokoro, a small open text-to-speech
 * model that runs locally on the server (lib/voice/tts.ts), and played in sync with the slides with captions.
 * Shared by the client (studio) and the server: plain TypeScript, no dependencies.
 */

/** English Kokoro voices worth offering (the better-graded ones of the 28 bundled with kokoro-js). */
export const VOICES = [
  { id: "af_heart", name: "Heart", accent: "American", gender: "female" },
  { id: "af_bella", name: "Bella", accent: "American", gender: "female" },
  { id: "af_nicole", name: "Nicole", accent: "American", gender: "female" },
  { id: "bf_emma", name: "Emma", accent: "British", gender: "female" },
  { id: "am_michael", name: "Michael", accent: "American", gender: "male" },
  { id: "am_fenrir", name: "Fenrir", accent: "American", gender: "male" },
  { id: "am_puck", name: "Puck", accent: "American", gender: "male" },
  { id: "bm_george", name: "George", accent: "British", gender: "male" },
  { id: "bm_fable", name: "Fable", accent: "British", gender: "male" },
] as const;
export type VoiceId = (typeof VOICES)[number]["id"];
export const VOICE_IDS = VOICES.map((v) => v.id) as [VoiceId, ...VoiceId[]];
export const voiceLabel = (id: string) => {
  const v = VOICES.find((x) => x.id === id);
  return v ? `${v.name} · ${v.accent} ${v.gender}` : id;
};

export interface VoiceSettings {
  /** speak each slide's narration (and write one when a slide is designed) */
  on: boolean;
  voice: VoiceId;
  /** 0.8 slower … 1.2 faster */
  speed: number;
  /** show the narration as captions under the slides */
  captions: boolean;
}
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { on: false, voice: "af_heart", speed: 1, captions: true };

/** Read stored settings defensively (old rows, hand-edited data): anything invalid falls back to the default. */
export function parseVoiceSettings(raw: unknown): VoiceSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_VOICE_SETTINGS;
  return {
    on: typeof r.on === "boolean" ? r.on : d.on,
    voice: VOICE_IDS.includes(r.voice as VoiceId) ? (r.voice as VoiceId) : d.voice,
    speed: typeof r.speed === "number" && r.speed >= 0.8 && r.speed <= 1.2 ? r.speed : d.speed,
    captions: typeof r.captions === "boolean" ? r.captions : d.captions,
  };
}

/**
 * True when a recording's captions (one per spoken sentence) add up to its whole script. An early sentence splitter
 * skipped text around decimals ("4.8"), so those recordings miss words: they count as out of date and get recorded again.
 */
export const voiceCoversText = (v: { text: string; captions?: { text: string }[] }) =>
  !v.captions?.length || v.captions.map((c) => c.text).join(" ") === v.text.replace(/\s+/g, " ").trim();

/** Kokoro speaks English only: other project languages can't have a voiceover. */
export const voiceoverLanguageOk = (language: string | undefined) => !language || language === "English";
