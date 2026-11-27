import { LayoutGrid, Mic, Palette, Plus, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The side panels the tool rail opens next to it (one at a time). */
export type PanelId = "library" | "slide" | "voice" | "theme";

const ITEMS: { id: PanelId; label: string; icon: LucideIcon; needs?: "project" | "slide" }[] = [
  { id: "library", label: "Library", icon: LayoutGrid },
  { id: "slide", label: "Slide", icon: SlidersHorizontal, needs: "slide" },
  { id: "voice", label: "Voice", icon: Mic, needs: "slide" },
  { id: "theme", label: "Theme", icon: Palette, needs: "project" },
];

const RAIL_BUTTON =
  "flex h-14 w-[58px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";

/** The left side nav: icon buttons that open a panel beside it, and New video at the bottom. */
export function ToolRail({
  active,
  onPick,
  hasProject,
  hasSlide,
  onNew,
}: {
  active: PanelId | null;
  onPick: (panel: PanelId | null) => void;
  hasProject: boolean;
  hasSlide: boolean;
  onNew: () => void;
}) {
  return (
    <nav aria-label="Tools" className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-2">
      {ITEMS.map(({ id, label, icon: Icon, needs }) => {
        const disabled = (needs === "slide" && !hasSlide) || (needs === "project" && !hasProject);
        const on = active === id && !disabled;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            title={disabled ? (needs === "slide" ? "Design a slide first" : "Open a video first") : undefined}
            onClick={() => onPick(on ? null : id)}
            className={cn(RAIL_BUTTON, on && "bg-accent font-medium text-foreground")}
          >
            <Icon className={cn("size-5", on && "text-primary")} />
            {label}
          </button>
        );
      })}
      <button type="button" onClick={onNew} className={cn(RAIL_BUTTON, "mt-auto")} title="New video (Alt + N)">
        <Plus className="size-5" />
        New
      </button>
    </nav>
  );
}

/** The panel the rail opened: a title, a close button, and the panel's own content. */
export function PanelShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside aria-label={title} className="flex w-[300px] shrink-0 flex-col border-r bg-sidebar xl:w-[320px]">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b pr-2 pl-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <span className="min-w-0 truncate text-xs text-muted-foreground">{subtitle}</span>}
        <Button variant="ghost" size="icon" className="ml-auto size-8 shrink-0" aria-label={`Close ${title.toLowerCase()}`} title="Close (Esc)" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}
