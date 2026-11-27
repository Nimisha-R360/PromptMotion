import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Registry } from "@/lib/api";

/** Rail → Theme: every theme as a small swatch card; picking one restyles the whole video. */
export function ThemePanel({ registry, value, onPick, disabled }: { registry: Registry | null; value: string; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs text-muted-foreground">Colours and fonts for every slide. Your words and animations stay the same.</p>
        <ul className="grid grid-cols-2 gap-2">
          {!registry && Array.from({ length: 6 }, (_, i) => <li key={i} className="pm-shimmer h-24 rounded-lg border bg-card/50" />)}
          {registry?.themes.map((t) => {
            const on = t.id === value;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => !on && onPick(t.id)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-lg border bg-card/40 p-1.5 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
                    on && "border-primary ring-1 ring-primary",
                  )}
                >
                  <span className="flex h-14 flex-col justify-center gap-1.5 rounded-md px-2.5" style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.bg2})` }}>
                    <span className="text-sm leading-none font-semibold" style={{ color: t.text, fontFamily: t.display }}>
                      Aa
                    </span>
                    <span className="flex gap-1">
                      <span className="h-1.5 w-6 rounded-full" style={{ background: t.accent }} />
                      <span className="h-1.5 w-4 rounded-full" style={{ background: t.accent2 }} />
                    </span>
                  </span>
                  <span className="flex items-center gap-1 px-1 text-xs">
                    {t.name}
                    {on && <Check className="ml-auto size-3.5 text-primary" aria-label="current theme" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
