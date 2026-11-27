import { useEffect, useRef, useState } from "react";
import { Clapperboard, Film, Loader2, Sparkles, Upload, Clock, Monitor, Tablet, Smartphone, RotateCw, GraduationCap, Lightbulb, Rocket, ChartColumn, Pencil, Mic, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Registry } from "@/lib/api";
import type { Studio } from "@/hooks/use-studio";
import { MOODS, type Mood, type ProjectSummary } from "@backend/lib/types";
import {
  AUDIENCES,
  LANGUAGES,
  SLIDE_COUNTS,
  TEMPLATES,
  getTemplate,
  hasStartOptions,
  startOptionsLabel,
  type Audience,
  type Language,
  type StartOptions,
  type TemplateId,
} from "@backend/lib/start-options";
import { FrameworkDot } from "./library-panel";
import { DeviceFrame, type Device } from "./device-frame";
import { TextEditorDialog, type TextTarget } from "./text-editor";
import { voiceState } from "./voice-panel";
import { SlideThumb } from "./slide-thumb";
import type { PanelId } from "./tool-rail";

const STATUS_STYLE = {
  pending: "bg-muted-foreground/40",
  review: "bg-amber-400",
  approved: "bg-emerald-400",
} as const;

export function PreviewPanel({ studio, registry, recent, onOpenPanel }: { studio: Studio; registry: Registry | null; recent: ProjectSummary[]; onOpenPanel: (panel: PanelId) => void }) {
  const { project, busy, previewIndex, scope } = studio;
  // app view: preview the same HTML at a tablet / mobile viewport (hooks must run before the early return)
  const [device, setDevice] = useState<Device>("desktop");
  const [landscape, setLandscape] = useState(false);
  // output format: timed video player, or a scrolling animated web page built from the same designs
  const [format, setFormat] = useState<"video" | "web">("video");
  // click-to-edit: the preview iframe reports which text was clicked (see runtime/index.ts, enableTextEditing)
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [editing, setEditing] = useState<{ index: number; target: TextTarget; key: number } | null>(null);
  const isBusy = !!busy;
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || e.source !== frame.contentWindow) return; // only our own preview
      const d = e.data as { type?: unknown; slide?: unknown; field?: unknown; i?: unknown } | null;
      if (d?.type !== "pm:editText" || typeof d.slide !== "number") return;
      if (isBusy) {
        toast.info("The AI is working: edit the text when it's done.");
        return;
      }
      frame.contentWindow?.postMessage({ type: "pm:pause" }, "*");
      setEditing({ index: d.slide, target: { field: typeof d.field === "string" ? d.field : undefined, i: typeof d.i === "number" ? d.i : undefined }, key: Date.now() });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isBusy]);
  if (!project) return <Landing studio={studio} recent={recent} />;

  const openEditor = (index: number) => {
    frameRef.current?.contentWindow?.postMessage({ type: "pm:pause" }, "*");
    setEditing({ index, target: {}, key: Date.now() });
  };
  const editingSpec = editing ? project.slides[editing.index]?.spec : null;

  const slide = project.slides[previewIndex];
  const designed = project.slides.filter((s) => s.spec).length;
  const approved = project.slides.filter((s) => s.status === "approved").length;
  const canPreview = scope === "all" || format === "web" ? designed > 0 : !!slide?.spec;
  const src = canPreview
    ? `/api/projects/${project.id}/preview?scope=${scope}&index=${previewIndex}&format=${format}&edit=1&v=${encodeURIComponent(project.updatedAt + project.theme)}`
    : null;
  const busyHere = busy && (busy.kind !== "slide" || busy.index === previewIndex || scope === "all");
  const theme = registry?.themes.find((t) => t.id === project.theme);
  // one control for what the player shows: this slide, the whole video, or the web page
  const view = format === "web" ? "web" : scope;
  const setView = (v: string) => {
    if (v === "web") return setFormat("web");
    setFormat("video");
    studio.setScope(v as "slide" | "all");
  };
  const showSlideActions = !!slide?.spec && view === "slide";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="h-8" aria-label="What to preview">
            <TabsTrigger value="slide" className="px-3 text-xs">
              Slide {previewIndex + 1}
            </TabsTrigger>
            <TabsTrigger value="all" className="px-3 text-xs" disabled={!designed}>
              Full video
            </TabsTrigger>
            <TabsTrigger value="web" className="px-3 text-xs" disabled={!designed} title="The same slides as a scrolling web page, animated on scroll">
              Web page
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center gap-2">
          {device !== "desktop" && (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setLandscape((l) => !l)} aria-label={landscape ? "Rotate to portrait" : "Rotate to landscape"} title={landscape ? "Portrait" : "Landscape"}>
              <RotateCw className={cn("size-3.5 transition-transform", landscape && "rotate-90")} />
            </Button>
          )}
          <Tabs value={device} onValueChange={(v) => setDevice(v as Device)}>
            <TabsList className="h-8" aria-label="Preview device">
              <TabsTrigger value="desktop" className="px-2" aria-label="Desktop" title="Desktop (16:9)">
                <Monitor className="size-4" />
              </TabsTrigger>
              <TabsTrigger value="tablet" className="px-2" aria-label="Tablet" title="Tablet app view">
                <Tablet className="size-4" />
              </TabsTrigger>
              <TabsTrigger value="mobile" className="px-2" aria-label="Mobile" title="Mobile app view">
                <Smartphone className="size-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* player, and the slide's quick actions under it */}
      <div className="pm-grid-bg relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 lg:p-6">
        {(() => {
          const screen = (
            <>
              {src ? (
                <iframe
                  ref={frameRef}
                  key={`${src}|${device}|${landscape}`}
                  src={src}
                  title={`Video preview (${device})`}
                  className="absolute inset-0 size-full"
                  sandbox="allow-scripts allow-popups"
                  allow="fullscreen; autoplay"
                />
              ) : (
                <EmptyPlayer stage={project.stage} index={previewIndex} busy={!!busy} />
              )}
              {busyHere && busy && <BusyOverlay status={busy.status} tokens={busy.tokens} startedAt={busy.startedAt} onCancel={studio.cancel} dim={!!src} />}
            </>
          );
          return device === "desktop" ? (
            <div className="relative aspect-video w-full max-w-[min(100%,calc((100dvh-330px)*16/9))] overflow-hidden rounded-xl border bg-black shadow-2xl shadow-black/50">{screen}</div>
          ) : (
            <DeviceFrame device={device} landscape={landscape}>
              {screen}
            </DeviceFrame>
          );
        })()}
        {showSlideActions && slide.spec && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 bg-background/60 text-xs" onClick={() => openEditor(previewIndex)} disabled={isBusy} title="Or click any text in the preview">
              <Pencil /> Edit text
            </Button>
            {(() => {
              const vs = voiceState(slide.spec, project.voiceover);
              const label = !project.voiceover.on ? "off" : vs === "ready" ? `${slide.spec.voice!.duration.toFixed(0)}s` : vs === "stale" ? "out of date" : "not recorded";
              return (
                <Button size="sm" variant="outline" className={cn("h-8 bg-background/60 text-xs", project.voiceover.on && vs !== "ready" && "border-amber-500/50")} onClick={() => onOpenPanel("voice")} title="Voiceover and captions">
                  <Mic /> Voiceover <span className="text-muted-foreground">{label}</span>
                </Button>
              );
            })()}
            <Button size="sm" variant="outline" className="h-8 bg-background/60 text-xs" onClick={() => onOpenPanel("slide")} title="Style and animations of this slide">
              <Sparkles /> Animations
            </Button>
            <span className="flex items-center gap-1 px-2 text-xs text-muted-foreground" title="How long the slide plays">
              <Clock className="size-3.5" /> {slide.spec.duration}s
            </span>
          </div>
        )}
      </div>

      {/* filmstrip */}
      <div className="flex items-start gap-4 border-t bg-sidebar/60 px-4 pt-3">
        <div className="hidden shrink-0 flex-col gap-0.5 pt-0.5 sm:flex">
          <span className="text-xs font-semibold">Slides</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {approved} of {project.slides.length} approved
          </span>
        </div>
        <ScrollArea className="min-w-0 flex-1">
          <ol className="flex gap-3 pb-3" aria-label="Slides">
            {project.slides.map((s) => {
              const current = s.index === previewIndex && view === "slide";
              const title = s.spec?.title ?? s.brief.title;
              const working = busy?.kind === "slide" && busy.index === s.index;
              return (
                <li key={s.index}>
                  <button
                    onClick={() => {
                      studio.setPreviewIndex(s.index);
                      setView("slide");
                    }}
                    aria-current={current}
                    aria-label={`Slide ${s.index + 1}: ${title} (${s.status === "review" ? "in review" : s.status})`}
                    className="group flex w-32 flex-col gap-1.5 text-left focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "relative block aspect-video w-full overflow-hidden rounded-md border transition-colors group-hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                        current && "border-primary ring-1 ring-primary",
                        !s.spec && "border-dashed",
                      )}
                    >
                      {s.spec ? <SlideThumb layout={s.spec.layout} theme={theme} /> : <span className="flex size-full items-center justify-center text-[10px] text-muted-foreground">Not designed yet</span>}
                      <span className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-px text-[10px] text-white tabular-nums">
                        <span className={cn("size-1.5 rounded-full", STATUS_STYLE[s.status])} />
                        {String(s.index + 1).padStart(2, "0")}
                      </span>
                      {working && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="size-4 animate-spin text-white" />
                        </span>
                      )}
                    </span>
                    <span className={cn("truncate text-xs", current ? "font-medium text-foreground" : "text-muted-foreground")}>{title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {editing && editingSpec && (
        <TextEditorDialog
          key={editing.key}
          spec={editingSpec}
          slideNumber={editing.index + 1}
          target={editing.target}
          onSave={(text) => studio.editSlideText(editing.index, text)}
          onClose={() => {
            setEditing(null);
            // resume the paused preview (after a save it reloads and plays anyway)
            frameRef.current?.contentWindow?.postMessage({ type: "pm:play" }, "*");
          }}
        />
      )}
    </div>
  );
}

function EmptyPlayer({ stage, index, busy }: { stage: string; index: number; busy: boolean }) {
  const text =
    stage === "outline" || stage === "outline_review"
      ? "Approve the outline in the chat to start designing slide 1."
      : busy
        ? ""
        : `Slide ${index + 1} hasn't been designed yet.`;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/10 via-transparent to-cyan-500/5 p-6 text-center">
      <Clapperboard className="size-10 text-muted-foreground/60" />
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

function BusyOverlay({ status, tokens, startedAt, onCancel, dim }: { status: string; tokens: number; startedAt: number; onCancel: () => void; dim: boolean }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.round((now - startedAt) / 1000));
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center p-6", dim ? "bg-black/60 backdrop-blur-[2px]" : "bg-black/30")} role="status" aria-live="polite">
      <div className="pm-shimmer flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card/90 p-5 text-center shadow-xl">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm font-medium">{status}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {tokens > 0 ? `${tokens} tokens from the local model · ` : "Waiting for the local model · "}
          {secs}s
        </p>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
          Stop waiting
        </Button>
      </div>
    </div>
  );
}

type ExampleCategory = "School" | "Business" | "Marketing";
const EXAMPLE_CATEGORIES: ExampleCategory[] = ["School", "Business", "Marketing"];
const EXAMPLES: { category: ExampleCategory; text: string; options: StartOptions }[] = [
  { category: "School", text: "Explain the atomic model for 9th graders: Dalton, Thomson, Rutherford, Bohr and the modern model.", options: { template: "lesson" } },
  { category: "School", text: "How the water cycle works: evaporation, condensation, precipitation and collection.", options: { template: "lesson", audience: "Kids", mood: "playful" } },
  {
    category: "School",
    text: "Explain how solar panels turn sunlight into electricity, with a stats slide (efficiency 22%, cost down 89% since 2010).",
    options: { template: "explainer", audience: "Students" },
  },
  { category: "Business", text: "Quarterly business review: revenue $4.2M (+38%), 1,200 new customers, churn 2.1%, roadmap for next quarter.", options: { template: "report" } },
  {
    category: "Business",
    text: "Onboarding for new employees: our mission, how the teams work together, the tools we use, the first-week checklist.",
    options: { template: "explainer", audience: "Professionals" },
  },
  { category: "Business", text: "Our new expense policy: what is covered, spending limits, how to submit receipts, approval times.", options: { template: "explainer", audience: "Professionals" } },
  {
    category: "Marketing",
    text: "Launch video for 'Nimbus', an AI note-taking app: the problem, 3 key features, pricing from $8/month, call to action.",
    options: { template: "launch" },
  },
  { category: "Marketing", text: "3 quick tips to sleep better tonight, ending with 'Follow for more'.", options: { template: "reel" } },
  { category: "Marketing", text: "Black Friday sale: 40% off all plans until Sunday, 3 reasons to upgrade now, code BF40.", options: { template: "reel", mood: "bold" } },
];

const TEMPLATE_ICON: Record<TemplateId, LucideIcon> = { lesson: GraduationCap, explainer: Lightbulb, launch: Rocket, reel: Smartphone, report: ChartColumn };

/** Template defaults (audience, length, mood) first, then explicit choices. */
function withTemplate(id: TemplateId | undefined, extra: StartOptions = {}): StartOptions {
  const t = getTemplate(id);
  return { ...(t ? { template: t.id, audience: t.audience, slides: t.slides, mood: t.mood } : {}), ...extra };
}

const AUTO = "auto";
function OptionSelect({
  label,
  value,
  items,
  autoLabel = "Auto",
  onChange,
  disabled,
}: {
  label: string;
  value: string | undefined;
  items: { value: string; label: string }[];
  autoLabel?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}) {
  const shown = items.find((i) => i.value === value)?.label ?? autoLabel;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <Select value={value ?? AUTO} onValueChange={(v) => onChange(v === AUTO ? undefined : v)} disabled={disabled}>
        <SelectTrigger size="sm" className="h-8 w-full text-xs" aria-label={label}>
          {/* explicit text: always shows the current choice, even before the list has been opened */}
          <SelectValue>{shown}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO} className="text-xs">
            {autoLabel}
          </SelectItem>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value} className="text-xs">
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Landing({ studio, recent }: { studio: Studio; recent: ProjectSummary[] }) {
  const [prompt, setPrompt] = useState("");
  const [opts, setOpts] = useState<StartOptions>({});
  const [category, setCategory] = useState<ExampleCategory>("School");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = !!studio.busy;
  const template = getTemplate(opts.template);
  const submit = () => prompt.trim().length >= 3 && studio.start(prompt.trim(), hasStartOptions(opts) ? opts : undefined);
  // picking a template fills in its audience / length / mood; picking it again clears them (the language stays)
  const pickTemplate = (id: TemplateId) => setOpts((o) => (o.template === id ? { language: o.language } : withTemplate(id, { language: o.language })));
  const set = (patch: StartOptions) => setOpts((o) => ({ ...o, ...patch }));

  return (
    <ScrollArea className="h-full">
      <div className="pm-grid-bg mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-6 py-10">
        <div className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit gap-1.5 text-[11px]">
            <FrameworkDot fw="remotion" /> <FrameworkDot fw="anime" /> <FrameworkDot fw="motion" /> <FrameworkDot fw="gsap" /> 80 modular animation components
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Turn a prompt or your slides into an animated video — as one HTML file.</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            An AI model (Claude or a local model) plans the story, then designs each slide from Remotion, anime.js, Motion and GSAP components. You approve or redesign every slide before moving on.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <div className="flex flex-col gap-3 rounded-xl border bg-card/70 p-4 md:col-span-3">
            <label htmlFor="landing-prompt" className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" /> Generate from a prompt
            </label>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Start from a template (optional)">
                {TEMPLATES.map((t) => {
                  const Icon = TEMPLATE_ICON[t.id];
                  const on = opts.template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      title={t.description}
                      onClick={() => pickTemplate(t.id)}
                      disabled={busy}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
                        on ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3.5" /> {t.name}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {template ? `${template.name}: ${template.description.toLowerCase()}. Change any option below.` : "Pick a template to fill in good defaults, or just describe your video."}
              </span>
            </div>
            <Textarea
              id="landing-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder={template?.placeholder ?? "Describe the video: topic, audience, number of slides, key facts…"}
              className="min-h-28 resize-none text-sm"
              disabled={busy}
            />
            <div className="grid grid-cols-2 gap-2">
              <OptionSelect
                label="Audience"
                value={opts.audience}
                items={AUDIENCES.map((a) => ({ value: a, label: a }))}
                onChange={(v) => set({ audience: v as Audience | undefined })}
                disabled={busy}
              />
              <OptionSelect
                label="Length"
                value={opts.slides?.toString()}
                items={SLIDE_COUNTS.map((n) => ({ value: String(n), label: `${n} slides` }))}
                onChange={(v) => set({ slides: v ? Number(v) : undefined })}
                disabled={busy}
              />
              <OptionSelect label="Mood" value={opts.mood} items={MOODS.map((m) => ({ value: m, label: capitalize(m) }))} onChange={(v) => set({ mood: v as Mood | undefined })} disabled={busy} />
              <OptionSelect
                label="Language"
                value={opts.language}
                autoLabel="English"
                items={LANGUAGES.filter((l) => l !== "English").map((l) => ({ value: l, label: l }))}
                onChange={(v) => set({ language: v as Language | undefined })}
                disabled={busy}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-[11px] leading-snug text-muted-foreground" title={hasStartOptions(opts) ? startOptionsLabel(opts) : undefined}>
                {hasStartOptions(opts) ? startOptionsLabel(opts) : "Ctrl/⌘ + Enter"}
              </span>
              <Button onClick={submit} disabled={busy || prompt.trim().length < 3} title="Ctrl/⌘ + Enter">
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Plan my video
              </Button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const files = Array.from(e.dataTransfer.files);
              if (files.length) studio.upload(files);
            }}
            disabled={busy}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/40 p-4 text-center transition-colors hover:border-primary/50 hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 md:col-span-2",
              drag && "border-primary bg-primary/10",
            )}
          >
            <Upload className="size-6 text-primary" />
            <span className="text-sm font-medium">Animate your slides</span>
            <span className="text-[11px] text-muted-foreground">Drop .pptx, .pdf, .md / .txt or slide images</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept=".pptx,.pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp,.gif,.svg"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) studio.upload(files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Try an example</span>
            <div className="flex gap-1" role="group" aria-label="Example category">
              {EXAMPLE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    category === c ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {EXAMPLES.filter((ex) => ex.category === category).map((ex) => {
              const t = getTemplate(ex.options.template);
              const Icon = t ? TEMPLATE_ICON[t.id] : Sparkles;
              return (
                <button
                  key={ex.text}
                  onClick={() => {
                    setPrompt(ex.text);
                    setOpts((o) => withTemplate(ex.options.template, { language: o.language, ...ex.options }));
                  }}
                  disabled={busy}
                  className="flex flex-col gap-1.5 rounded-lg border bg-card/40 p-3 text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                >
                  {t && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-foreground/80">
                      <Icon className="size-3" /> {t.name}
                    </span>
                  )}
                  {ex.text}
                </button>
              );
            })}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Recent projects</span>
            <ul className="grid gap-2 sm:grid-cols-2">
              {recent.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => studio.openProject(p.id)}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card/40 p-3 text-left transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Film className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{p.title}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {p.mode === "upload" ? "Uploaded" : "Prompt"} · {p.approvedCount}/{p.slideCount} approved
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
