import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Registry } from "@/lib/api";
import { isLightTheme, type Theme } from "@backend/runtime/themes";

/** Rail → Theme: every theme as a small swatch card, dark ones then light ones; picking one restyles the whole video. */
export function ThemePanel({ registry, value, onPick, disabled }: { registry: Registry | null; value: string; onPick: (id: string) => void; disabled?: boolean }) {
  const themes = registry?.themes ?? [];
  const groups: [string, Theme[]][] = [
    ["Dark", themes.filter((t) => !isLightTheme(t))],
    ["Light", themes.filter((t) => isLightTheme(t))],
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 p-4">
        <p className="text-xs text-muted-foreground">Colours and fonts for every slide. Your words and animations stay the same.</p>
        {!registry && (
          <ul className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="pm-shimmer h-24 rounded-lg border bg-card/50" />
            ))}
          </ul>
        )}
        {groups.map(
          ([label, list]) =>
            list.length > 0 && (
              <section key={label} aria-label={`${label} themes`} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
                <ul className="grid grid-cols-2 gap-2">
                  {list.map((t) => {
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
                          <span className="flex h-14 flex-col justify-center gap-1.5 rounded-md border border-black/5 px-2.5" style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.bg2})` }}>
                            <span className="text-sm leading-none font-semibold" style={{ color: t.text, fontFamily: t.display }}>
                              Aa
                            </span>
                            <span className="flex gap-1">
                              <span className="h-1.5 w-6 rounded-full" style={{ background: t.accent }} />
                              <span className="h-1.5 w-4 rounded-full" style={{ background: t.accent2 }} />
                            </span>
                          </span>
                          <span className="flex items-center gap-1 px-1 text-xs">
                            {t.name.replace(/\s*\(light\)$/i, "")}
                            {on && <Check className="ml-auto size-3.5 text-primary" aria-label="current theme" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
        )}
      </div>
    </div>
  );
}
