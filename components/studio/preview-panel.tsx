"use client";
import { useEffect, useRef, useState } from "react";
import { Clapperboard, Download, Film, Loader2, Play, Sparkles, Upload, Clock, Layers, ChevronDown, Square, Monitor, Tablet, Smartphone, RotateCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Registry } from "@/lib/client/api";
import type { Studio } from "@/hooks/use-studio";
import type { ProjectSummary } from "@/lib/types";
import { FrameworkDot } from "./library-panel";
import { STYLES, STYLE_INFO, type Framework, type Slot } from "@/runtime/types";
import { slotsFor } from "@/runtime/layouts";
import { DeviceFrame, type Device } from "./device-frame";

const STATUS_STYLE = {
  pending: "bg-muted-foreground/40",
  review: "bg-amber-400",
  approved: "bg-emerald-400",
} as const;

export function PreviewPanel({ studio, registry, recent }: { studio: Studio; registry: Registry | null; recent: ProjectSummary[] }) {
  const { project, busy, previewIndex, scope } = studio;
  // app view: preview the same HTML at a tablet / mobile viewport (hooks must run before the early return)
  const [device, setDevice] = useState<Device>("desktop");
  const [landscape, setLandscape] = useState(false);
  // output format: timed video player, or a scrolling animated web page built from the same designs
  const [format, setFormat] = useState<"video" | "web">("video");
  if (!project) return <Landing studio={studio} recent={recent} />;

  const slide = project.slides[previewIndex];
  const designed = project.slides.filter((s) => s.spec).length;
  const approved = project.slides.filter((s) => s.status === "approved").length;
  const canPreview = scope === "all" || format === "web" ? designed > 0 : !!slide?.spec;
  const src = canPreview
    ? `/api/projects/${project.id}/preview?scope=${scope}&index=${previewIndex}&format=${format}&v=${encodeURIComponent(project.updatedAt + project.theme)}`
    : null;
  const busyHere = busy && (busy.kind !== "slide" || busy.index === previewIndex || scope === "all");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Tabs value={format === "web" ? "all" : scope} onValueChange={(v) => studio.setScope(v as "slide" | "all")}>
          <TabsList className="h-8">
            <TabsTrigger value="slide" className="text-xs" disabled={format === "web"}>
              <Square className="size-3.5" /> Slide {previewIndex + 1}
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs" disabled={!designed}>
              <Film className="size-3.5" /> Full video
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={format} onValueChange={(v) => setFormat(v as "video" | "web")}>
          <TabsList className="h-8" aria-label="Output format">
            <TabsTrigger value="video" className="text-xs" title="Video: timed player with transitions">
              <Film className="size-3.5" /> <span className="hidden xl:inline">Video</span>
            </TabsTrigger>
            <TabsTrigger value="web" className="text-xs" title="Web page: scrolling sections, animations on scroll">
              <Globe className="size-3.5" /> <span className="hidden xl:inline">Web page</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={device} onValueChange={(v) => setDevice(v as Device)}>
          <TabsList className="h-8" aria-label="Preview device">
            <TabsTrigger value="desktop" className="text-xs" title="Desktop (16:9)">
              <Monitor className="size-3.5" /> <span className="hidden xl:inline">Desktop</span>
            </TabsTrigger>
            <TabsTrigger value="tablet" className="text-xs" title="Tablet app view">
              <Tablet className="size-3.5" /> <span className="hidden xl:inline">Tablet</span>
            </TabsTrigger>
            <TabsTrigger value="mobile" className="text-xs" title="Mobile app view">
              <Smartphone className="size-3.5" /> <span className="hidden xl:inline">Mobile</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {device !== "desktop" && (
          <Button variant="outline" size="icon" className="size-8" onClick={() => setLandscape((l) => !l)} aria-label={landscape ? "Rotate to portrait" : "Rotate to landscape"} title={landscape ? "Portrait" : "Landscape"}>
            <RotateCw className={cn("size-3.5 transition-transform", landscape && "rotate-90")} />
          </Button>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {approved}/{project.slides.length} approved
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={project.theme} onValueChange={studio.setTheme}>
            <SelectTrigger size="sm" className="h-8 w-[150px] text-xs" aria-label="Video theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {registry?.themes.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className="flex">
                      <span className="size-3 rounded-full border" style={{ background: t.bg }} />
                      <span className="-ml-1 size-3 rounded-full" style={{ background: t.accent }} />
                      <span className="-ml-1 size-3 rounded-full" style={{ background: t.accent2 }} />
                    </span>
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={!designed}>
                <Download /> Export <ChevronDown className="opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem asChild disabled={!approved}>
                <a href={`/api/projects/${project.id}/export`} download>
                  <Download /> Approved slides ({approved}) · .html
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/projects/${project.id}/export?draft=1`} download>
                  <Clapperboard /> Draft incl. slides in review ({designed})
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild disabled={!approved}>
                <a href={`/api/projects/${project.id}/export?format=web`} download>
                  <Globe /> Web page: approved slides ({approved}) · .html
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/projects/${project.id}/export?format=web&draft=1`} download>
                  <Globe /> Web page: draft incl. slides in review ({designed})
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/projects/${project.id}/preview?scope=all`} target="_blank" rel="noreferrer">
                  <Play /> Open full video in new tab
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/projects/${project.id}/preview?scope=all&format=web`} target="_blank" rel="noreferrer">
                  <Globe /> Open web page in new tab
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* player */}
      <div className="pm-grid-bg relative flex min-h-0 flex-1 items-center justify-center p-4 lg:p-6">
        {(() => {
          const screen = (
            <>
              {src ? (
                <iframe
                  key={`${src}|${device}|${landscape}`}
                  src={src}
                  title={`Video preview (${device})`}
                  className="absolute inset-0 size-full"
                  sandbox="allow-scripts allow-popups"
                  allow="fullscreen"
                />
              ) : (
                <EmptyPlayer stage={project.stage} index={previewIndex} busy={!!busy} />
              )}
              {busyHere && busy && <BusyOverlay status={busy.status} tokens={busy.tokens} startedAt={busy.startedAt} onCancel={studio.cancel} dim={!!src} />}
            </>
          );
          return device === "desktop" ? (
            <div className="relative aspect-video w-full max-w-[min(100%,calc((100dvh-260px)*16/9))] overflow-hidden rounded-xl border bg-black shadow-2xl shadow-black/50">{screen}</div>
          ) : (
            <DeviceFrame device={device} landscape={landscape}>
              {screen}
            </DeviceFrame>
          );
        })()}
      </div>

      {/* filmstrip + inspector */}
      <div className="border-t bg-sidebar/60">
        <ScrollArea className="w-full">
          <ol className="flex gap-2 px-4 py-3" aria-label="Slides">
            {project.slides.map((s) => (
              <li key={s.index}>
                <button
                  onClick={() => {
                    studio.setPreviewIndex(s.index);
                    studio.setScope("slide");
                  }}
                  aria-current={s.index === previewIndex && scope === "slide"}
                  className={cn(
                    "flex w-44 flex-col gap-1 rounded-lg border bg-card/60 p-2 text-left transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    s.index === previewIndex && scope === "slide" && "border-primary/70 bg-primary/10",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", STATUS_STYLE[s.status])} />
                    {String(s.index + 1).padStart(2, "0")} · {s.spec?.layout ?? s.brief.layout ?? "slide"}
                    {busy?.kind === "slide" && busy.index === s.index && <Loader2 className="ml-auto size-3 animate-spin text-primary" />}
                  </span>
                  <span className="truncate text-xs font-medium">{s.spec?.title ?? s.brief.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {slide?.spec && scope === "slide" && (
          <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-2 text-[11px]">
            <Badge variant="outline" className="gap-1 text-[11px]">
              <Layers className="size-3" /> {slide.spec.layout}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[11px]">
              <Clock className="size-3" /> {slide.spec.duration}s
            </Badge>
            <Select value={slide.spec.style ?? STYLES[slide.index % STYLES.length]} onValueChange={studio.setSlideStyle} disabled={!!busy}>
              <SelectTrigger size="sm" className="h-6 gap-1 px-2 text-[11px]" aria-label="Slide style">
                <span className="text-muted-foreground">style</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((st) => (
                  <SelectItem key={st} value={st} className="text-xs" title={STYLE_INFO[st]}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {slotsFor(slide.spec.layout).map((slotName: Slot) => {
              const id = slide.spec!.animations[slotName];
              const meta = registry?.components.find((c) => c.id === id);
              return (
                <Tooltip key={slotName}>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 rounded-md border bg-card/60 px-1.5 py-0.5">
                      <span className="text-muted-foreground">{slotName}</span>
                      <FrameworkDot fw={id.split(".")[0] as Framework} />
                      {meta?.name ?? id}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <code className="font-mono">{id}</code>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
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

const EXAMPLES = [
  "A 5-slide launch video for 'Nimbus', an AI note-taking app: problem, 3 key features, pricing from $8/month, call to action.",
  "Explain how solar panels turn sunlight into electricity in 4 slides, with a stats slide (efficiency 22%, cost down 89% since 2010).",
  "Quarterly business review: revenue $4.2M (+38%), 1,200 new customers, churn 2.1%, roadmap for next quarter.",
];

function Landing({ studio, recent }: { studio: Studio; recent: ProjectSummary[] }) {
  const [prompt, setPrompt] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = !!studio.busy;
  const submit = () => prompt.trim().length >= 3 && studio.start(prompt.trim());

  return (
    <ScrollArea className="h-full">
      <div className="pm-grid-bg mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-6 py-10">
        <div className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit gap-1.5 text-[11px]">
            <FrameworkDot fw="remotion" /> <FrameworkDot fw="anime" /> <FrameworkDot fw="motion" /> <FrameworkDot fw="gsap" /> 80 modular animation components
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Turn a prompt or your slides into an animated video — as one HTML file.</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A local model plans the story, then designs each slide from Remotion, anime.js, Motion and GSAP components. You approve or redesign every slide before moving on.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <div className="flex flex-col gap-3 rounded-xl border bg-card/70 p-4 md:col-span-3">
            <label htmlFor="landing-prompt" className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" /> Generate from a prompt
            </label>
            <Textarea
              id="landing-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder="Describe the video: topic, audience, number of slides, key facts…"
              className="min-h-28 resize-none text-sm"
              disabled={busy}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter</span>
              <Button onClick={submit} disabled={busy || prompt.trim().length < 3}>
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
          <span className="text-xs font-medium text-muted-foreground">Try an example</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-lg border bg-card/40 p-3 text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {ex}
              </button>
            ))}
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
