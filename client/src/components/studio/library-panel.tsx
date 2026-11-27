import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ListFilter, Search, Wand2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Registry } from "@/lib/api";
import type { ComponentMeta } from "@backend/runtime/registry";
import type { Category, Framework, SlideSpec } from "@backend/runtime/types";
import { CATEGORY_SLOT } from "@backend/runtime/demo";
import { RemocnBrowser } from "./remocn-browser";

const CATEGORY_LABEL: Record<Category, string> = {
  card: "Cards",
  text: "Text effects",
  entrance: "Entrances",
  list: "Lists",
  number: "Counters",
  chart: "Charts",
  background: "Backgrounds",
  decor: "Decorations",
  transition: "Transitions",
  scene: "Scenes",
};
/** What each category changes on a slide, in plain words. */
const CATEGORY_HINT: Record<Category, string> = {
  card: "A content block filled with the slide's words",
  text: "How the title appears",
  entrance: "How the body text comes in",
  list: "Bullets and cards coming in one by one",
  number: "Numbers that count up",
  chart: "Charts for slides with numbers",
  background: "Moving backgrounds behind the content",
  decor: "Icons, shapes and illustrations",
  transition: "How the slide changes to the next one",
  scene: "Full-frame animated scenes",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

/** Which part of the library is open: one category, the remocn scene gallery, or the category list (null). */
export type LibraryCategory = Category | "remocn" | null;

export function FrameworkDot({ fw, className }: { fw: Framework; className?: string }) {
  const color = { remotion: "bg-remotion", anime: "bg-anime", motion: "bg-motion", gsap: "bg-gsap", remocn: "bg-remocn", onda: "bg-onda", magicui: "bg-magicui", lottie: "bg-lottie" }[fw];
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", color, className)} />;
}

interface Props {
  registry: Registry | null;
  theme: string;
  currentSpec: SlideSpec | null;
  currentIndex: number;
  onApply: (slot: string, id: string, layout?: string) => void;
  /** Onda card on the current slide (null removes it) */
  onApplyCard: (id: string | null, name?: string) => void;
  /** the open category (the Slide panel's "Change" opens one) */
  category: LibraryCategory;
  onCategoryChange: (category: LibraryCategory) => void;
}

/** Rail → Library: categories first, then the effects in one; search looks through all of them. */
export function LibraryPanel({ registry, theme, currentSpec, currentIndex, onApply, onApplyCard, category, onCategoryChange }: Props) {
  const [query, setQuery] = useState("");
  const [fw, setFw] = useState<Framework | "all">("all");
  const [selected, setSelected] = useState<ComponentMeta | null>(null);

  const inUse = useMemo(() => new Set(currentSpec ? [...Object.values(currentSpec.animations), ...(currentSpec.card ? [currentSpec.card] : [])] : []), [currentSpec]);
  // remocn has its own gallery; the categories list the core engines (and Onda, Magic UI, Lottie)
  const core = useMemo(() => (registry?.components ?? []).filter((c) => c.framework !== "remocn"), [registry]);
  const remocn = useMemo(() => (registry?.components ?? []).filter((c) => c.framework === "remocn"), [registry]);
  const engines = useMemo(() => registry?.frameworks.filter((f) => f.id !== "remocn") ?? [], [registry]);
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: core.length };
    core.forEach((c) => (m[c.framework] = (m[c.framework] ?? 0) + 1));
    return m;
  }, [core]);

  const remocnView = category === "remocn";
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      core.filter(
        (c) =>
          (fw === "all" || c.framework === fw) &&
          (remocnView || !category || c.category === category) &&
          (!q || `${c.name} ${c.id} ${c.description} ${c.uses.join(" ")} ${c.mood.join(" ")}`.toLowerCase().includes(q)),
      ),
    [core, fw, category, remocnView, q],
  );
  const cats = CATEGORIES.filter((c) => core.some((x) => x.category === c && (fw === "all" || x.framework === fw)));
  const engineName = engines.find((f) => f.id === fw)?.name.replace(" (Framer)", "");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search the library"
              placeholder={remocnView ? "Search scenes, e.g. terminal, pricing…" : "Search effects, e.g. scramble"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {!remocnView && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className={cn("size-8 shrink-0", fw !== "all" && "border-primary/60 bg-primary/10 text-primary")} aria-label="Filter by animation engine" title="Filter by animation engine">
                  <ListFilter />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Animation engine</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={fw} onValueChange={(v) => setFw(v as Framework | "all")}>
                  <DropdownMenuRadioItem value="all" className="text-xs">
                    All engines <span className="ml-auto text-muted-foreground tabular-nums">{counts.all}</span>
                  </DropdownMenuRadioItem>
                  {engines.map((f) => (
                    <DropdownMenuRadioItem key={f.id} value={f.id} className="text-xs">
                      <FrameworkDot fw={f.id} /> {f.name.replace(" (Framer)", "")}
                      <span className="ml-auto text-muted-foreground tabular-nums">{counts[f.id] ?? 0}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {fw !== "all" && !remocnView && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FrameworkDot fw={fw} /> Only {engineName}
            <button onClick={() => setFw("all")} className="ml-auto rounded px-1 text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              Show all
            </button>
          </p>
        )}
        {category && (
          <button
            onClick={() => onCategoryChange(null)}
            className="-ml-1 flex w-fit items-center gap-0.5 rounded px-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronLeft className="size-3.5" /> All categories
            <span className="ml-1 font-medium text-foreground">· {remocnView ? "remocn scenes" : CATEGORY_LABEL[category]}</span>
          </button>
        )}
      </div>

      {remocnView ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {registry ? (
            <RemocnBrowser components={remocn} query={query} currentSpec={currentSpec} currentIndex={currentIndex} onApply={onApply} onPreview={setSelected} />
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="pm-shimmer h-32 rounded-lg border bg-card/50" />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-3">
            {!registry && Array.from({ length: 6 }).map((_, i) => <div key={i} className="pm-shimmer h-14 rounded-lg border bg-card/50" />)}

            {/* the category list: the starting point */}
            {registry && !category && !q && (
              <ul className="flex flex-col gap-1.5" aria-label="Categories">
                {cats.map((c) => (
                  <li key={c}>
                    <CategoryRow label={CATEGORY_LABEL[c]} hint={CATEGORY_HINT[c]} count={shown.filter((x) => x.category === c).length} onClick={() => onCategoryChange(c)} />
                  </li>
                ))}
                {fw === "all" && remocn.length > 0 && (
                  <li>
                    <CategoryRow label="remocn scenes" hint="Ready-made scenes: terminals, pricing, logos and more" count={remocn.length} onClick={() => onCategoryChange("remocn")} />
                  </li>
                )}
              </ul>
            )}

            {/* one category, or search results across all of them */}
            {registry && (category || q) && !shown.length && <p className="px-2 py-8 text-center text-xs text-muted-foreground">Nothing matches{q ? ` “${query}”` : ""}.</p>}
            {registry &&
              (category || q) &&
              CATEGORIES.map((c) => {
                const list = shown.filter((x) => x.category === c);
                if (!list.length) return null;
                return (
                  <section key={c} aria-label={CATEGORY_LABEL[c]} className="flex flex-col gap-1.5">
                    {!category && <h3 className="px-1 text-[11px] font-medium text-muted-foreground">{CATEGORY_LABEL[c]}</h3>}
                    <ul className="flex flex-col gap-1.5">
                      {list.map((comp) => (
                        <li key={comp.id}>
                          <button
                            onClick={() => setSelected(comp)}
                            className="flex w-full items-start gap-2.5 rounded-lg border bg-card/60 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <FrameworkDot fw={comp.framework} className="mt-1.5" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">{comp.name}</span>
                                {inUse.has(comp.id) && (
                                  <Badge variant="secondary" className="ml-auto h-4 shrink-0 px-1.5 text-[10px]">
                                    On slide
                                  </Badge>
                                )}
                              </span>
                              <span className="line-clamp-1 text-xs text-muted-foreground">{comp.description}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
          </div>
        </div>
      )}

      <ComponentDialog comp={selected} theme={theme} onClose={() => setSelected(null)} currentSpec={currentSpec} currentIndex={currentIndex} onApply={onApply} onApplyCard={onApplyCard} />
    </div>
  );
}

function CategoryRow({ label, hint, count, onClick }: { label: string; hint: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border bg-card/60 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
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
  onApplyCard,
}: {
  comp: ComponentMeta | null;
  theme: string;
  onClose: () => void;
  currentSpec: SlideSpec | null;
  currentIndex: number;
  onApply: (slot: string, id: string, layout?: string) => void;
  onApplyCard: (id: string | null, name?: string) => void;
}) {
  // a chart is drawn on chart slides: a slide with numbers switches to the chart layout, one without can't take it
  const chartSwitch = comp?.category === "chart" && !!currentSpec && currentSpec.layout !== "chart";
  const noNumbers = chartSwitch && !currentSpec?.stats?.length;
  const isCard = comp?.category === "card";
  const slot = comp && comp.category !== "card" ? CATEGORY_SLOT[comp.category] : null;
  // a card isn't an animation slot: the slide either shows this card, another card, or none
  const current = currentSpec ? (isCard ? (currentSpec.card ?? null) : slot ? currentSpec.animations[slot] : null) : null;
  const currentName = isCard && current ? `the ${current.split(".").pop()!.replace(/-/g, " ")}` : current;
  return (
    <Dialog open={!!comp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        {comp && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FrameworkDot fw={comp.framework} className="size-2.5" /> {comp.name}
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
            {comp.mood.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Mood</span>
                {comp.mood.map((m) => (
                  <Badge key={m} variant="outline" className="text-[11px]">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {!currentSpec
                  ? "Design a slide first to apply components to it."
                  : isCard
                    ? current === comp.id
                      ? `Slide ${currentIndex + 1} shows this card, filled with its own words.`
                      : current
                        ? `Slide ${currentIndex + 1} shows ${currentName}: this card replaces it.`
                        : `The card is filled with slide ${currentIndex + 1}'s words. No AI step.`
                    : noNumbers
                      ? `Slide ${currentIndex + 1} has no numbers to chart. Pick a slide with numbers, or ask the AI for a chart slide.`
                      : chartSwitch
                        ? `Slide ${currentIndex + 1} becomes a chart slide: its numbers are drawn with this chart.`
                        : current === comp.id
                          ? `Already used for “${slot}” on slide ${currentIndex + 1}.`
                          : `Slide ${currentIndex + 1} “${slot}” currently uses ${current}.`}
              </p>
              <div className="flex gap-2">
                {isCard && currentSpec && current === comp.id && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onApplyCard(null);
                      onClose();
                    }}
                  >
                    Remove from slide {currentIndex + 1}
                  </Button>
                )}
                <Button
                  disabled={!currentSpec || noNumbers || (current === comp.id && !chartSwitch)}
                  onClick={() => {
                    if (isCard) onApplyCard(comp.id, comp.name);
                    else onApply(slot!, comp.id, chartSwitch ? "chart" : undefined);
                    onClose();
                  }}
                >
                  <Wand2 /> {isCard ? "Add" : "Apply"} to slide {currentIndex + 1}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
