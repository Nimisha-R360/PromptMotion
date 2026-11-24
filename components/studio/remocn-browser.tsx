"use client";
import { useMemo, useState } from "react";
import { ImageIcon, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ComponentMeta } from "@/runtime/registry";
import type { Category, SlideSpec } from "@/runtime/types";
import { slotsFor } from "@/runtime/layouts";
import { CATEGORY_SLOT } from "@/runtime/demo";

/**
 * The remocn registry (~870 React/Remotion components) as a searchable gallery: filter by kind and topic, preview,
 * and "Use it" to put a component on the slide in view (scenes turn the slide into a full-frame showcase).
 */

const KINDS: { id: Category | "media"; label: string }[] = [
  { id: "scene", label: "Scenes" },
  { id: "text", label: "Text" },
  { id: "background", label: "Backgrounds" },
  { id: "decor", label: "Icons" },
  { id: "media", label: "Shows your image" },
];
const KIND_BADGE: Partial<Record<Category, string>> = { scene: "scene", text: "text", background: "background", decor: "icon" };

/** quick topic filters (only shown when something matches) */
const TOPICS = ["app", "launch", "logo", "product", "card", "chart", "stat", "code", "terminal", "chat", "phone", "browser", "button", "cursor", "map", "calendar", "notification", "dashboard", "pricing", "github", "photo", "gradient"];

const PAGE = 24;
const haystack = (c: ComponentMeta) => `${c.id} ${c.name} ${c.description} ${c.mood.join(" ")}`.toLowerCase();

/** every query word must match; name/id hits rank first */
function search(list: ComponentMeta[], q: string): ComponentMeta[] {
  const words = q.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (!words.length) return list;
  const scored: { c: ComponentMeta; s: number }[] = [];
  for (const c of list) {
    const name = `${c.id} ${c.name}`.toLowerCase();
    const hay = haystack(c);
    let s = 0;
    let ok = true;
    for (const w of words) {
      const stem = w.length > 4 ? w.replace(/(ing|es|s)$/, "") : w;
      if (name.includes(w) || name.includes(stem)) s += 3;
      else if (hay.includes(w) || hay.includes(stem)) s += 1;
      else ok = false;
    }
    if (ok) scored.push({ c, s });
  }
  return scored.sort((a, b) => b.s - a.s).map((x) => x.c);
}

interface Props {
  components: ComponentMeta[];
  query: string;
  currentSpec: SlideSpec | null;
  currentIndex: number;
  onApply: (slot: string, id: string) => void;
  onPreview: (c: ComponentMeta) => void;
}

export function RemocnBrowser({ components, query, currentSpec, currentIndex, onApply, onPreview }: Props) {
  const [kind, setKind] = useState<Category | "media" | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [filterKey, setFilterKey] = useState("");

  const byKind = useMemo(() => components.filter((c) => !kind || (kind === "media" ? c.media : c.category === kind)), [components, kind]);
  const topics = useMemo(() => TOPICS.filter((t) => byKind.some((c) => haystack(c).includes(t))), [byKind]);
  const results = useMemo(() => search(byKind, [query, topic].filter(Boolean).join(" ")), [byKind, query, topic]);

  // a new search / filter starts from the first page
  const key = `${kind}|${topic}|${query}`;
  if (key !== filterKey) {
    setFilterKey(key);
    setLimit(PAGE);
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of components) {
      m[c.category] = (m[c.category] ?? 0) + 1;
      if (c.media) m.media = (m.media ?? 0) + 1;
    }
    return m;
  }, [components]);

  /** why "Use it" can't apply to the slide in view (or null when it can) */
  const blocked = (c: ComponentMeta): string | null => {
    if (!currentSpec) return "Design a slide first, then use components on it.";
    const slot = CATEGORY_SLOT[c.category];
    if (currentSpec.animations[slot] === c.id) return `Already on slide ${currentIndex + 1}.`;
    if (slot !== "scene" && !slotsFor(currentSpec.layout).includes(slot)) return `A ${currentSpec.layout} slide has no ${slot} slot.`;
    return null;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1.5 border-b px-3 py-2">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="remocn kind">
          <Chip active={!kind} onClick={() => setKind(null)}>
            All <span className="text-muted-foreground/70 tabular-nums">{components.length}</span>
          </Chip>
          {KINDS.map((k) => (
            <Chip key={k.id} active={kind === k.id} onClick={() => setKind(kind === k.id ? null : k.id)}>
              {k.id === "media" && <ImageIcon className="size-3" />}
              {k.label} <span className="text-muted-foreground/70 tabular-nums">{counts[k.id] ?? 0}</span>
            </Chip>
          ))}
        </div>
        {topics.length > 0 && (
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="remocn topic">
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(topic === t ? null : t)}
                aria-pressed={topic === t}
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  topic === t ? "bg-remocn/25 text-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="@container flex flex-col gap-3 p-3">
          <p className="px-1 text-[11px] text-muted-foreground">
            {results.length} component{results.length === 1 ? "" : "s"}
            {currentSpec ? ` · “Use it” puts it on slide ${currentIndex + 1}` : " · design a slide to use them"}
          </p>
          {!results.length && <p className="px-2 py-8 text-center text-xs text-muted-foreground">No remocn components match{query ? ` “${query}”` : ""}.</p>}
          <ul className="grid grid-cols-1 gap-2 @[300px]:grid-cols-2">
            {results.slice(0, limit).map((c) => {
              const why = blocked(c);
              const slot = CATEGORY_SLOT[c.category];
              return (
                <li key={c.id} className="flex flex-col overflow-hidden rounded-lg border bg-card/60 transition-colors hover:border-remocn/50">
                  <button onClick={() => onPreview(c)} className="group relative aspect-video w-full overflow-hidden bg-muted text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Preview ${c.name}`}>
                    <Thumb c={c} />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Preview</span>
                    {c.media && (
                      <span className="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-px text-[9px] text-white" title="Shows your uploaded image">
                        <ImageIcon className="size-2.5" /> your image
                      </span>
                    )}
                  </button>
                  <div className="flex flex-1 flex-col gap-1 p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium" title={c.name}>
                        {c.name}
                      </span>
                      <Badge variant="outline" className="ml-auto h-4 shrink-0 px-1 text-[9px]">
                        {KIND_BADGE[c.category] ?? c.category}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-[10.5px] leading-snug text-muted-foreground" title={c.description}>
                      {c.description}
                    </p>
                    <Button size="sm" variant={why ? "outline" : "default"} className="mt-auto h-7 text-[11px]" disabled={!!why} title={why ?? `Use for the ${slot} of slide ${currentIndex + 1}`} onClick={() => onApply(slot, c.id)}>
                      <Wand2 className="size-3" /> Use it
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {results.length > limit && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLimit((n) => n + PAGE * 2)}>
              Show more ({results.length - limit} left)
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/** Pre-rendered frame (npm run remocn:thumbs → public/remocn-thumbs); a placeholder when it hasn't been generated. */
function Thumb({ c }: { c: ComponentMeta }) {
  const [failed, setFailed] = useState(false);
  const name = c.id.slice("remocn.".length);
  if (failed)
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-remocn/25 via-card to-primary/20 p-2 text-center">
        <Sparkles className="size-4 text-remocn" />
        <span className="line-clamp-2 text-[10px] font-medium text-foreground/80">{c.name}</span>
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/remocn-thumbs/${name}.jpg`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-remocn/60 bg-remocn/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
