import { Clock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Registry } from "@/lib/api";
import type { Studio } from "@/hooks/use-studio";
import { STYLES, STYLE_INFO, type Framework, type Slot } from "@backend/runtime/types";
import { slotsFor } from "@backend/runtime/layouts";
import { FrameworkDot } from "./library-panel";

/** Plain names for the animation slots a layout has. */
const SLOT_LABEL: Record<Slot, string> = {
  title: "Title effect",
  body: "Text entrance",
  items: "List and cards",
  number: "Number counter",
  chart: "Chart",
  background: "Background",
  decor: "Decoration",
  transition: "Transition to the next slide",
  scene: "Scene",
};

const layoutName = (layout: string) => {
  const s = layout.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Rail → Slide: the current slide's style, card and animations, each with a way to change it. */
export function SlidePanel({ studio, registry, onChangeSlot, onChangeCard }: { studio: Studio; registry: Registry | null; onChangeSlot: (slot: Slot) => void; onChangeCard: () => void }) {
  const project = studio.project;
  const index = studio.previewIndex;
  const spec = project?.slides[index]?.spec;
  const busy = !!studio.busy;
  if (!spec) return <p className="p-4 text-sm text-muted-foreground">Slide {index + 1} hasn&apos;t been designed yet.</p>;
  const meta = (id?: string) => (id ? registry?.components.find((c) => c.id === id) : undefined);
  const card = meta(spec.card);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-5 p-4">
        <section className="flex flex-col gap-1.5">
          <p className="text-sm leading-snug font-medium">{spec.title}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="size-3.5" /> {layoutName(spec.layout)} layout
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> {spec.duration}s
            </span>
          </p>
        </section>

        <section className="flex flex-col gap-1.5">
          <label htmlFor="slide-style" className="text-xs font-medium text-muted-foreground">
            Style
          </label>
          <Select value={spec.style ?? STYLES[index % STYLES.length]} onValueChange={studio.setSlideStyle} disabled={busy}>
            <SelectTrigger id="slide-style" size="sm" className="w-full text-xs">
              {/* just the name here; the list shows what each style does */}
              <SelectValue>
                <span className="capitalize">{spec.style ?? STYLES[index % STYLES.length]}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STYLES.map((st) => (
                <SelectItem key={st} value={st} className="text-xs">
                  <span className="flex flex-col">
                    <span className="capitalize">{st}</span>
                    <span className="text-[11px] text-muted-foreground">{STYLE_INFO[st]}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="flex flex-col gap-1.5" aria-label="Animations">
          <h3 className="text-xs font-medium text-muted-foreground">Animations</h3>
          <ul className="flex flex-col gap-1.5">
            {slotsFor(spec.layout).map((slot) => {
              const id = spec.animations[slot];
              const m = meta(id);
              return (
                <li key={slot} className="flex items-center gap-2 rounded-lg border bg-card/50 py-1.5 pr-1.5 pl-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-muted-foreground">{SLOT_LABEL[slot]}</span>
                    <span className="flex items-center gap-1.5 text-sm">
                      {id && <FrameworkDot fw={(m?.framework ?? id.split(".")[0]) as Framework} />}
                      <span className="truncate">{m?.name ?? id ?? "None"}</span>
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onChangeSlot(slot)} disabled={busy}>
                    Change
                  </Button>
                </li>
              );
            })}
            <li className="flex items-center gap-2 rounded-lg border bg-card/50 py-1.5 pr-1.5 pl-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-muted-foreground">Content card</span>
                <span className="flex items-center gap-1.5 text-sm">
                  {card && <FrameworkDot fw={card.framework} />}
                  <span className="truncate">{card?.name ?? (spec.card ? spec.card : "None")}</span>
                </span>
              </span>
              {spec.card && (
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => studio.applyCard(null)} disabled={busy}>
                  Remove
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onChangeCard} disabled={busy}>
                {spec.card ? "Change" : "Add"}
              </Button>
            </li>
          </ul>
          <p className="text-[11px] leading-snug text-muted-foreground">Or ask the AI director, for example “a calmer background”.</p>
        </section>
      </div>
    </div>
  );
}
