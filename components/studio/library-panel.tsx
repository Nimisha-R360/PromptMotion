"use client";
import { useMemo, useState } from "react";
import { Search, Boxes, Code2, Wand2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Registry } from "@/lib/client/api";
import type { ComponentMeta } from "@/runtime/registry";
import type { Category, Framework, SlideSpec } from "@/runtime/types";
import { CATEGORY_SLOT } from "@/runtime/demo";
import { RemocnBrowser } from "./remocn-browser";

const CATEGORY_LABEL: Record<Category, string> = {
  text: "Text effects",
  entrance: "Entrances",
  list: "Lists & stagger",
  number: "Counters",
  chart: "Charts",
  background: "Backgrounds",
  decor: "Decor & SVG",
  transition: "Transitions",
  scene: "Scenes (remocn)",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export function FrameworkDot({ fw, className }: { fw: Framework; className?: string }) {
  const color = { remotion: "bg-remotion", anime: "bg-anime", motion: "bg-motion", gsap: "bg-gsap", remocn: "bg-remocn" }[fw];
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", color, className)} />;
}

interface Props {
  registry: Registry | null;
  theme: string;
  currentSpec: SlideSpec | null;
  currentIndex: number;
  onApply: (slot: string, id: string) => void;
}

export function LibraryPanel({ registry, theme, currentSpec, currentIndex, onApply }: Props) {
  const [query, setQuery] = useState("");
  const [fw, setFw] = useState<Framework | "all">("all");
  const [cat, setCat] = useState<Category | null>(null);
  const [selected, setSelected] = useState<ComponentMeta | null>(null);
  const [tab, setTab] = useState("components");

  const inUse = useMemo(() => new Set(currentSpec ? Object.values(currentSpec.animations) : []), [currentSpec]);
  // remocn has its own gallery tab; the Components tab lists the core engines
  const core = useMemo(() => (registry?.components ?? []).filter((c) => c.framework !== "remocn"), [registry]);
  const remocn = useMemo(() => (registry?.components ?? []).filter((c) => c.framework === "remocn"), [registry]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return core.filter(
      (c) =>
        (fw === "all" || c.framework === fw) &&
        (!cat || c.category === cat) &&
        (!q || `${c.name} ${c.id} ${c.description} ${c.uses.join(" ")} ${c.mood.join(" ")}`.toLowerCase().includes(q)),
    );
  }, [core, query, fw, cat]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: core.length };
    core.forEach((c) => (m[c.framework] = (m[c.framework] ?? 0) + 1));
    return m;
  }, [core]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex flex-col gap-3 border-b px-3 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Boxes className="size-4 text-primary" /> Library
            </h2>
            <TabsList className="h-7">
              <TabsTrigger value="components" className="px-2 text-xs">
                Components
              </TabsTrigger>
              <TabsTrigger value="remocn" className="gap-1 px-2 text-xs">
                <FrameworkDot fw="remocn" /> remocn
              </TabsTrigger>
              <TabsTrigger value="primitives" className="px-2 text-xs">
                Primitives
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search components" placeholder={tab === "remocn" ? "Search remocn, e.g. terminal, pricing, logo…" : "Search effects, e.g. scramble, spring…"} value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8 text-xs" />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className={cn("flex flex-wrap gap-1", tab === "remocn" && "hidden")} role="group" aria-label="Framework filter">
            {(["all", ...(registry?.frameworks.filter((f) => f.id !== "remocn").map((f) => f.id) ?? [])] as (Framework | "all")[]).map((id) => (
              <button
                key={id}
                onClick={() => setFw(id)}
                aria-pressed={fw === id}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  fw === id ? "border-primary/60 bg-primary/15 text-foreground" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {id !== "all" && <FrameworkDot fw={id} />}
                {id === "all" ? "All" : registry?.frameworks.find((f) => f.id === id)?.name.replace(" (Framer)", "")}
                <span className="text-muted-foreground/70 tabular-nums">{counts[id] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <TabsContent value="components" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div className="flex gap-1 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none]">
            <CatChip active={!cat} onClick={() => setCat(null)} label="All" />
            {CATEGORIES.filter((c) => core.some((x) => x.category === c)).map((c) => (
              <CatChip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)} label={CATEGORY_LABEL[c]} />
            ))}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-3">
              {!registry &&
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="pm-shimmer h-16 rounded-lg border bg-card/50" />)}
              {registry && !filtered.length && (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">No components match “{query}”.</p>
              )}
              {CATEGORIES.map((c) => {
                const list = filtered.filter((x) => x.category === c);
                if (!list.length) return null;
                return (
                  <section key={c} aria-label={CATEGORY_LABEL[c]}>
                    <h3 className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {CATEGORY_LABEL[c]}
                      <span className="font-normal normal-case">slot: {CATEGORY_SLOT[c]}</span>
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {list.map((comp) => (
                        <li key={comp.id}>
                          <button
                            onClick={() => setSelected(comp)}
                            className="group w-full rounded-lg border bg-card/60 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <div className="flex items-center gap-2">
                              <FrameworkDot fw={comp.framework} />
                              <span className="truncate text-xs font-medium">{comp.name}</span>
                              {inUse.has(comp.id) && (
                                <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
                                  in slide {currentIndex + 1}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{comp.description}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {comp.uses.slice(0, 3).map((u) => (
                                <code key={u} className="rounded bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground">
                                  {u}
                                </code>
                              ))}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="remocn" className="mt-0 flex min-h-0 flex-1 flex-col">
          {registry ? (
            <RemocnBrowser components={remocn} query={query} currentSpec={currentSpec} currentIndex={currentIndex} onApply={onApply} onPreview={setSelected} />
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="pm-shimmer h-32 rounded-lg border bg-card/50" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="primitives" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-4 p-3">
              {registry?.frameworks
                .filter((f) => fw === "all" || f.id === fw)
                .map((f) => (
                  <section key={f.id} className="rounded-lg border bg-card/50 p-3">
                    <h3 className="flex items-center gap-2 text-xs font-semibold">
                      <FrameworkDot fw={f.id} /> {f.name} <span className="font-normal text-muted-foreground">v{f.version}</span>
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{f.description}</p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {registry.primitives
                        .filter((p) => p.framework === f.id && (!query || `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase())))
                        .map((p) => (
                          <li key={p.name} className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5">
                              <Code2 className="size-3 text-muted-foreground" />
                              <code className="font-mono text-[11px]">{p.name}</code>
                              <span className="text-[10px] text-muted-foreground">{p.kind}</span>
                            </span>
                            <span className="pl-4.5 text-[11px] text-muted-foreground">{p.description}</span>
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <ComponentDialog comp={selected} theme={theme} onClose={() => setSelected(null)} currentSpec={currentSpec} currentIndex={currentIndex} onApply={onApply} />
    </div>
  );
}

function CatChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-primary/60 bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ComponentDialog({
  comp,
  theme,
  onClose,
  currentSpec,
  currentIndex,
  onApply,
}: {
  comp: ComponentMeta | null;
  theme: string;
  onClose: () => void;
  currentSpec: SlideSpec | null;
  currentIndex: number;
  onApply: (slot: string, id: string) => void;
}) {
  const slot = comp ? CATEGORY_SLOT[comp.category] : null;
  const current = currentSpec && slot ? currentSpec.animations[slot] : null;
  return (
    <Dialog open={!!comp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        {comp && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FrameworkDot fw={comp.framework} className="size-2.5" /> {comp.name}
                <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">{comp.id}</code>
              </DialogTitle>
              <DialogDescription>{comp.description}</DialogDescription>
            </DialogHeader>
            <div className="overflow-hidden rounded-lg border bg-black">
              <iframe
                key={comp.id + theme}
                title={`${comp.name} preview`}
                src={`/api/registry/${encodeURIComponent(comp.id)}/preview?theme=${theme}`}
                className="aspect-video w-full"
                sandbox="allow-scripts"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Built with</span>
              {comp.uses.map((u) => (
                <code key={u} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {u}
                </code>
              ))}
              <span className="ml-2 text-muted-foreground">Mood</span>
              {comp.mood.map((m) => (
                <Badge key={m} variant="outline" className="text-[11px]">
                  {m}
                </Badge>
              ))}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {currentSpec
                  ? current === comp.id
                    ? `Already used for “${slot}” on slide ${currentIndex + 1}.`
                    : `Slide ${currentIndex + 1} “${slot}” currently uses ${current}.`
                  : "Design a slide first to apply components to it."}
              </p>
              <Button
                disabled={!currentSpec || current === comp.id}
                onClick={() => {
                  onApply(slot!, comp.id);
                  onClose();
                }}
              >
                <Wand2 /> Apply to slide {currentIndex + 1}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
