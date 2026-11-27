import { useState } from "react";
import { Captions, Loader2, Mic, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Studio } from "@/hooks/use-studio";
import { VOICES, voiceCoversText, voiceLabel, voiceoverLanguageOk, type VoiceId } from "@backend/lib/voice/voices";

const SPEEDS = [
  { value: "0.9", label: "Slower" },
  { value: "1", label: "Normal speed" },
  { value: "1.1", label: "Faster" },
];

/** What the slide's recording says about its narration: none, up to date, or made from older words. */
export function voiceState(
  spec: { narration?: string; voice?: { text: string; voice: string; speed: number; duration: number; captions?: { text: string }[] } } | null | undefined,
  settings: { voice: string; speed: number },
) {
  if (!spec?.voice) return spec?.narration ? "unrecorded" : "none";
  if (spec.voice.text !== (spec.narration ?? "").trim() || spec.voice.voice !== settings.voice || spec.voice.speed !== settings.speed || !voiceCoversText(spec.voice)) return "stale";
  return "ready";
}

/**
 * Rail → Voice: the voiceover for the video (on/off, voice, speed, captions) and for the current slide: its narration,
 * written by the AI and editable, recorded by the local voice model. Remount it (key) when the slide or its saved
 * narration changes, so the text box starts from the saved words.
 */
export function VoicePanel({ studio, index }: { studio: Studio; index: number }) {
  const project = studio.project!;
  const slide = project.slides[index];
  const settings = project.voiceover;
  const [draft, setDraft] = useState(slide?.spec?.narration ?? "");
  const busy = !!studio.busy;
  const english = voiceoverLanguageOk(project.options.language);
  const state = voiceState(slide?.spec, settings);
  const changed = draft.trim() !== (slide?.spec?.narration ?? "").trim();
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const audio = slide?.spec?.voice?.src?.startsWith("asset:") ? `/api/projects/${project.id}/media/${slide.spec.voice.src.slice(6)}` : undefined;

  if (!english)
    return (
      <p className="m-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        This video is in {project.options.language}. The voice speaks English only, so voiceover isn&apos;t available for it.
      </p>
    );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-5 p-4">
        {/* the whole video */}
        <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-3" aria-label="Voiceover settings">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">For this video</p>
              <p className="text-xs leading-snug text-muted-foreground">{settings.on ? "On: new and redesigned slides get one automatically." : "Off: the video plays silently."}</p>
            </div>
            <Button size="sm" variant={settings.on ? "outline" : "default"} disabled={busy} onClick={() => studio.setVoiceover({ on: !settings.on })}>
              {settings.on ? "Turn off" : "Turn on"}
            </Button>
          </div>
          <Select value={settings.voice} onValueChange={(v) => studio.setVoiceover({ voice: v as VoiceId })} disabled={busy}>
            <SelectTrigger size="sm" className="w-full text-xs" aria-label="Voice">
              <SelectValue>{voiceLabel(settings.voice)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {v.name} · {v.accent} {v.gender}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={String(settings.speed)} onValueChange={(v) => studio.setVoiceover({ speed: Number(v) })} disabled={busy}>
              <SelectTrigger size="sm" className="w-full text-xs" aria-label="Speaking speed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEEDS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={settings.captions}
              className={cn("text-xs", settings.captions && "border-primary/60 bg-primary/10")}
              disabled={busy}
              onClick={() => studio.setVoiceover({ captions: !settings.captions })}
            >
              <Captions /> Captions {settings.captions ? "on" : "off"}
            </Button>
          </div>
          {settings.on && (
            <Button size="sm" variant="ghost" className="h-auto justify-start py-1.5 text-left text-xs whitespace-normal" disabled={busy} onClick={() => studio.makeVoiceover()}>
              <RefreshCw /> Make or update every slide&apos;s voiceover
            </Button>
          )}
        </section>

        {/* this slide */}
        {slide?.spec && (
          <section className="flex flex-col gap-2" aria-label={`Slide ${index + 1} voiceover`}>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="vo-text" className="text-sm font-medium">
                What the voice says
              </label>
              <span className={cn("text-xs tabular-nums", words > 60 ? "text-amber-500" : "text-muted-foreground")}>
                {words} words{words ? ` · ~${Math.max(1, Math.round(words / 2.6))}s` : ""}
              </span>
            </div>
            <Textarea
              id="vo-text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              maxLength={700}
              placeholder={settings.on ? "Empty: the AI writes it when you record." : "Turn voiceover on and the AI writes this for you, or type it yourself."}
              className="resize-none text-sm"
            />
            <p className="text-xs leading-snug text-muted-foreground">
              {state === "ready" && `Recorded: ${slide.spec.voice!.duration.toFixed(1)}s with ${voiceLabel(slide.spec.voice!.voice)}.`}
              {state === "stale" && "The recording is out of date: record it again to match the words, voice and speed."}
              {state === "unrecorded" && (settings.on ? "Not recorded yet." : "Turn voiceover on to record it.")}
              {state === "none" && "No voiceover yet."}
              {slide.spec.narrationEdited && " You wrote this one: redesigning the slide keeps it."}
            </p>
            {audio && state !== "none" && <audio controls src={audio} className="h-8 w-full" aria-label={`Slide ${index + 1} voiceover`} />}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                disabled={busy || (!changed && (state === "ready" || !settings.on))}
                onClick={() => (changed ? studio.editNarration(index, draft) : studio.makeVoiceover(index))}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Mic />}
                {changed ? (settings.on ? "Save and record" : "Save") : "Record"}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy || !settings.on} onClick={() => studio.makeVoiceover(index, true)}>
                <Sparkles /> Rewrite with AI
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
