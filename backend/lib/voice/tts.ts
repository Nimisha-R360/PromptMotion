import "server-only";
import path from "node:path";
import { DATA_DIR } from "@/lib/db";
import type { SlideVoice } from "@/runtime/types";

/**
 * Local text-to-speech with Kokoro (82M parameters, Apache-2.0) through kokoro-js on the CPU (onnxruntime-node).
 * The model (~90 MB, q8) downloads once from Hugging Face into data/models/hf; the voices ship inside kokoro-js.
 * Each sentence is spoken separately: that gives exact timings for the captions (and avoids the model's 510-token cap).
 */

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const SAMPLE_RATE = 24000;
/** speech compresses well: 48 kbps mono MP3 at 24 kHz is about 0.35 MB a minute */
const MP3_KBPS = 48;
/** pause between sentences, seconds */
const GAP = 0.28;

type Kokoro = import("kokoro-js").KokoroTTS;
type GenerateOptions = import("kokoro-js").GenerateOptions;

declare global {
  var __pmKokoro: Promise<Kokoro> | undefined;
  var __pmVoiceQueue: Promise<unknown> | undefined;
}

/** The model, loaded once per server process (kept across dev reloads). */
function engine(): Promise<Kokoro> {
  globalThis.__pmKokoro ??= (async () => {
    const { env } = await import("@huggingface/transformers");
    env.cacheDir = path.join(DATA_DIR, "models", "hf");
    const { KokoroTTS } = await import("kokoro-js");
    return KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" });
  })().catch((e) => {
    globalThis.__pmKokoro = undefined;
    throw new Error(`The voice model could not be loaded (${(e as Error).message}). The first use downloads it (~90 MB) from Hugging Face.`);
  });
  return globalThis.__pmKokoro;
}

/** One voice job at a time: the model shares the CPU with the local LLM. */
function queued<T>(job: () => Promise<T>): Promise<T> {
  const run = (globalThis.__pmVoiceQueue ?? Promise.resolve()).then(job, job);
  globalThis.__pmVoiceQueue = run.catch(() => {});
  return run;
}

/** Split narration into sentences (keeps "3.2", "e.g." and "Dr." together). */
export function sentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  // a sentence ends at . ! ? … followed by a space or the end; one followed by more text ("4.8", "e.g.") is inside it
  const re = /(?:[^.!?…]|[.!?…](?=\S))+(?:[.!?…]+(?=\s|$)|$)/g;
  for (const m of clean.matchAll(re)) {
    const s = m[0].trim();
    if (!s) continue;
    const prev = out[out.length - 1];
    // a fragment like "e.g." or "Dr." belongs to the next words
    if (prev && /\b(?:e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|St|No)\.$/i.test(prev)) out[out.length - 1] = `${prev} ${s}`;
    else out.push(s);
  }
  return out;
}

async function toMp3(samples: Float32Array): Promise<Buffer> {
  // the package's CommonJS build exports nothing: import() picks its ES module build
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const enc = new Mp3Encoder(1, SAMPLE_RATE, MP3_KBPS);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const parts: Uint8Array[] = [];
  const BLOCK = 1152 * 16;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const out = enc.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (out.length) parts.push(out);
  }
  const end = enc.flush();
  if (end.length) parts.push(end);
  return Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.length)));
}

export interface Speech {
  mp3: Buffer;
  duration: number;
  captions: SlideVoice["captions"];
}

/** Speak `text` with a Kokoro voice: MP3 audio, its length and one caption per sentence. */
export function speak(text: string, voice: string, speed = 1): Promise<Speech> {
  return queued(async () => {
    const tts = await engine();
    const parts = sentences(text);
    if (!parts.length) throw new Error("There is no narration to speak.");
    const chunks: Float32Array[] = [];
    const captions: SlideVoice["captions"] = [];
    const gap = new Float32Array(Math.round(GAP * SAMPLE_RATE));
    let t = 0;
    for (const [i, s] of parts.entries()) {
      const audio = await tts.generate(s, { voice: voice as GenerateOptions["voice"], speed });
      const samples = audio.audio as Float32Array;
      const d = samples.length / SAMPLE_RATE;
      captions.push({ text: s, start: round(t), end: round(t + d) });
      chunks.push(samples);
      t += d;
      if (i < parts.length - 1) {
        chunks.push(gap);
        t += GAP;
      }
    }
    const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      all.set(c, o);
      o += c.length;
    }
    return { mp3: await toMp3(all), duration: round(t), captions };
  });
}

const round = (s: number) => Math.round(s * 100) / 100;

/** Load the model ahead of time (e.g. when voiceover is switched on), so the first slide doesn't wait for it. */
export function warmUp() {
  engine().catch(() => {});
}
