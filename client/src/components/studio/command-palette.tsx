import { useTheme } from "next-themes";
import { Check, CircleCheck, Clapperboard, Cpu, FolderOpen, Keyboard, Monitor, Moon, Play, Plus, RefreshCw, Square, Sun, Trash2 } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { Studio } from "@/hooks/use-studio";
import type { ProjectSummary } from "@backend/lib/types";
import { THEMES } from "@backend/runtime/themes";

export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

/** ⌘K: every studio action in one searchable list: projects, slides, approval, video theme, app theme, model. */
export function CommandPalette({
  open,
  onOpenChange,
  studio,
  recent,
  onOpenModelSettings,
  onShowShortcuts,
  onDeleteProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studio: Studio;
  recent: ProjectSummary[];
  onOpenModelSettings: () => void;
  onShowShortcuts: () => void;
  onDeleteProject: (p: { id: string; title: string }) => void;
}) {
  const { theme, setTheme } = useTheme();
  const { project, busy, previewIndex, scope } = studio;
  const slide = project?.slides[previewIndex];
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Search for a project, slide or action">
      <Command>
      <CommandInput placeholder="Type a command or search projects…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {project && (
          <CommandGroup heading="This video">
            {project.stage === "outline_review" && (
              <CommandItem disabled={!!busy} onSelect={run(studio.approveOutline)}>
                <CircleCheck /> Approve outline and start designing
              </CommandItem>
            )}
            {slide?.status === "review" && (
              <CommandItem disabled={!!busy} onSelect={run(() => studio.approveSlide(previewIndex))}>
                <CircleCheck /> Approve slide {previewIndex + 1}
              </CommandItem>
            )}
            {slide?.spec && (
              <CommandItem disabled={!!busy} onSelect={run(() => studio.redesign(previewIndex, ""))}>
                <RefreshCw /> Redesign slide {previewIndex + 1}
              </CommandItem>
            )}
            <CommandItem onSelect={run(() => studio.setScope(scope === "all" ? "slide" : "all"))}>
              {scope === "all" ? <Square /> : <Play />} {scope === "all" ? "Show the current slide" : "Play the full video"}
            </CommandItem>
            {busy && (
              <CommandItem onSelect={run(studio.cancel)}>
                <Square /> Stop: {busy.status}
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {project && project.slides.length > 0 && (
          <CommandGroup heading="Go to slide">
            {project.slides.map((s) => (
              <CommandItem
                key={s.index}
                value={`slide ${s.index + 1} ${s.brief.title}`}
                onSelect={run(() => {
                  studio.setPreviewIndex(s.index);
                  studio.setScope("slide");
                })}
              >
                <span className="w-5 text-right font-mono text-xs text-muted-foreground">{s.index + 1}</span>
                <span className="truncate">{s.brief.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{s.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {project && (
          <CommandGroup heading="Video theme">
            {THEMES.map((t) => (
              <CommandItem key={t.id} value={`video theme ${t.name}`} disabled={!!busy} onSelect={run(() => studio.setTheme(t.id))}>
                <span className="size-3.5 rounded-full border" style={{ background: `linear-gradient(135deg, ${t.bg2}, ${t.accent})` }} />
                {t.name}
                {project.theme === t.id && <Check className="ml-auto" />}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Projects">
          <CommandItem onSelect={run(() => studio.openProject(null))}>
            <Plus /> New video
            <CommandShortcut>Alt N</CommandShortcut>
          </CommandItem>
          {recent.slice(0, 20).map((p) => (
            <CommandItem key={p.id} value={`open ${p.title} ${p.id}`} onSelect={run(() => studio.openProject(p.id))}>
              {project?.id === p.id ? <Clapperboard /> : <FolderOpen />}
              <span className="truncate">{p.title}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {p.approvedCount}/{p.slideCount}
              </span>
            </CommandItem>
          ))}
          {project && (
            <CommandItem value={`delete project ${project.title}`} onSelect={run(() => onDeleteProject(project))} className="text-destructive data-[selected=true]:text-destructive">
              <Trash2 className="text-destructive" /> Delete this project…
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="App">
          <CommandItem onSelect={run(onOpenModelSettings)}>
            <Cpu /> Model settings
          </CommandItem>
          <CommandItem onSelect={run(onShowShortcuts)}>
            <Keyboard /> Keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          {(["dark", "light", "system"] as const).map((t) => (
            <CommandItem key={t} value={`app appearance ${t}`} onSelect={run(() => setTheme(t))}>
              {t === "dark" ? <Moon /> : t === "light" ? <Sun /> : <Monitor />}
              Appearance: {t[0].toUpperCase() + t.slice(1)}
              {theme === t && <Check className="ml-auto" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [MOD, "K"], label: "Open the command palette" },
  { keys: ["/"], label: "Focus the message box" },
  { keys: ["←", "→"], label: "Previous / next slide" },
  { keys: ["Alt", "N"], label: "New video" },
  { keys: ["Esc"], label: "Stop the running task" },
  { keys: ["?"], label: "Show this list" },
  { keys: ["Enter"], label: "Send a message (Shift + Enter for a new line)" },
  { keys: [MOD, "Enter"], label: "Create the video from the start screen" },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work through a video without leaving the keyboard.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 py-2">
              <span className="text-muted-foreground">{s.label}</span>
              <KbdGroup>
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </KbdGroup>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
