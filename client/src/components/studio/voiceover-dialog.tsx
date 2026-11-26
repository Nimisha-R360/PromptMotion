"use client";
import { useState } from "react";
import { Captions, Loader2, Mic, RefreshCw, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Studio } from "@/hooks/use-studio";
import { VOICES, voiceLabel, voiceoverLanguageOk, type VoiceId } from "@backend/lib/voice/voices";

const SPEEDS = [
  { value: "0.9", label: "Slower" },
  { value: "1", label: "Normal" },
  { value: "1.1", label: "Faster" },
];

/** What the slide's recording says about its narration: none, up to date, or made from older words. */
export function voiceState(spec: { narration?: string; voice?: { text: string; voice: string; speed: number; duration: number } } | null | undefined, settings: { voice: string; speed: number }) {
  if (!spec?.voice) return spec?.narration ? "unrecorded" : "none";
  if (spec.voice.text !== (spec.narration ?? "").trim() || spec.voice.voice !== settings.voice || spec.voice.speed !== settings.speed) return "stale";
  return "ready";
}

/**
 * Voiceover for the video (on/off, voice, speed, captions) and for one slide: its narration, written by the AI and
 * editable, recorded by the local voice model.
 */
export function VoiceoverDialog({ studio, index, onClose }: { studio: Studio; index: number; onClose: () => void }) {
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

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="size-4 text-primary" /> Voiceover
          </DialogTitle>
          <DialogDescription>
            The AI writes what a presenter says over each slide; a voice model on this computer speaks it in sync with the slides, with captions. English
            only.
          </DialogDescription>
        </DialogHeader>

        {!english ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            This video is in {project.options.language}. The voice speaks English only, so voiceover isn&apos;t available for it.
          </p>
        ) : (
          <>
            {/* the whole video */}
            <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-3" aria-label="Voiceover settings">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Voiceover for this video</p>
                  <p className="text-xs text-muted-foreground">{settings.on ? "On: new and redesigned slides get one automatically." : "Off: the video plays silently."}</p>
                </div>
                <Button size="sm" variant={settings.on ? "outline" : "default"} disabled={busy} onClick={() => studio.setVoiceover({ on: !settings.on })}>
                  {settings.on ? "Turn off" : "Turn on"}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Select value={settings.voice} onValueChange={(v) => studio.setVoiceover({ voice: v as VoiceId })} disabled={busy}>
                  <SelectTrigger size="sm" className="text-xs" aria-label="Voice">
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
                <Select value={String(settings.speed)} onValueChange={(v) => studio.setVoiceover({ speed: Number(v) })} disabled={busy}>
                  <SelectTrigger size="sm" className="text-xs" aria-label="Speaking speed">
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
                <Button size="sm" variant="ghost" className="w-fit text-xs" disabled={busy} onClick={() => studio.makeVoiceover()}>
                  <RefreshCw /> Make or update the voiceover for every slide
                </Button>
              )}
            </section>

            {/* this slide */}
            {slide?.spec && (
              <section className="flex flex-col gap-2" aria-label={`Slide ${index + 1} voiceover`}>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="vo-text" className="text-sm font-medium">
                    Slide {index + 1}: what the voice says
                  </label>
                  <span className={cn("text-xs", words > 60 ? "text-amber-500" : "text-muted-foreground")}>
                    {words} words{words ? ` · about ${Math.max(1, Math.round(words / 2.6))}s` : ""}
                  </span>
                </div>
                <Textarea
                  id="vo-text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  maxLength={700}
                  placeholder={settings.on ? "Empty: the AI writes it when you record." : "Turn voiceover on and the AI writes this for you, or type it yourself."}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {state === "ready" && `Recorded: ${slide.spec.voice!.duration.toFixed(1)}s with ${voiceLabel(slide.spec.voice!.voice)}.`}
                  {state === "stale" && "The recording is out of date: record it again to match the words, voice and speed."}
                  {state === "unrecorded" && (settings.on ? "Not recorded yet." : "Turn voiceover on to record it.")}
                  {state === "none" && "No voiceover yet."}
                  {slide.spec.narrationEdited && " You wrote this one: redesigning the slide keeps it."}
                </p>
                {audio && state !== "none" && <audio controls src={audio} className="h-8 w-full" aria-label={`Slide ${index + 1} voiceover`} />}
              </section>
            )}
          </>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          {english && slide?.spec && (
            <Button variant="ghost" size="sm" disabled={busy || !settings.on} onClick={() => studio.makeVoiceover(index, true).then((p) => p && setDraft(p.slides[index]?.spec?.narration ?? ""))}>
              <Sparkles /> Rewrite with AI
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {english && slide?.spec && (
              <Button
                disabled={busy || (!changed && (state === "ready" || !settings.on))}
                onClick={async () => {
                  if (changed) {
                    if (await studio.editNarration(index, draft)) onClose();
                  } else await studio.makeVoiceover(index);
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Mic />}
                {changed ? (settings.on ? "Save and record" : "Save") : "Record"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
