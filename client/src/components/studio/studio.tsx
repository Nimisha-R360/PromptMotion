import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { formatDistanceToNowStrict } from "date-fns";
import { Clapperboard, FolderOpen, Keyboard, Moon, Plus, Search, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { api, type LlmStatus, type Registry } from "@/lib/api";
import { useStudio } from "@/hooks/use-studio";
import type { ProjectSummary } from "@backend/lib/types";
import { LibraryPanel } from "./library-panel";
import { PreviewPanel } from "./preview-panel";
import { ChatPanel } from "./chat-panel";
import { ModelStatus } from "./model-status";
import { CommandPalette, MOD, ShortcutsDialog } from "./command-palette";

/** true while the user is typing somewhere, so single-key shortcuts don't steal their keystrokes */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.closest("[role=dialog],[role=listbox],[role=menu]"));

export function Studio() {
  const studio = useStudio();
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [llm, setLlm] = useState<LlmStatus | null>(null);
  const [recent, setRecent] = useState<ProjectSummary[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    api.registry().then(setRegistry).catch((e) => toast.error(`Could not load component library: ${e.message}`));
  }, []);
  // poll faster while the model is busy or warming up so the status badge stays live
  const llmBusy = !!studio.busy || !!llm?.activity || (!!llm?.online && !llm.warm);
  const [llmRefresh, setLlmRefresh] = useState(0);
  useEffect(() => {
    const poll = () => api.llm().then(setLlm).catch(() => setLlm({ provider: "local", online: false, model: null, url: "", warm: false, activity: null }));
    poll();
    const t = setInterval(poll, llmBusy ? 3000 : 15000);
    return () => clearInterval(t);
  }, [llmBusy, llmRefresh]);
  const projectKey = studio.project?.id + String(studio.project?.stage);
  useEffect(() => {
    api.projects().then((r) => setRecent(r.data)).catch(() => {});
  }, [projectKey]);

  const project = studio.project;
  const currentSpec = project?.slides[studio.previewIndex]?.spec ?? null;

  // keep the browser tab title in step with the open video
  useEffect(() => {
    document.title = project ? `${project.title} · Prompt Motion` : "Prompt Motion — animated HTML video studio";
  }, [project]);

  const deleteProject = async () => {
    if (!toDelete) return;
    const p = toDelete;
    setToDelete(null);
    try {
      await api.remove(p.id);
      setRecent((r) => r.filter((x) => x.id !== p.id));
      if (project?.id === p.id) studio.openProject(null);
      toast.success(`Deleted “${p.title}”`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // global shortcuts: ⌘K palette, / focus message, ←/→ slides, Alt+N new video, Esc stop, ? help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.altKey && e.code === "KeyN") {
        e.preventDefault();
        studio.openProject(null);
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        const input = document.getElementById("pm-chat-input") ?? document.getElementById("landing-prompt");
        if (input) {
          e.preventDefault();
          input.focus();
        }
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === "Escape" && studio.busy) {
        studio.cancel();
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && project?.slides.length) {
        e.preventDefault();
        const next = Math.min(project.slides.length - 1, Math.max(0, studio.previewIndex + (e.key === "ArrowLeft" ? -1 : 1)));
        studio.setPreviewIndex(next);
        studio.setScope("slide");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, project]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <button onClick={() => studio.openProject(null)} className="flex items-center gap-2 rounded-md px-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Prompt Motion home">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400 text-white">
            <Clapperboard className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Prompt Motion</span>
        </button>
        {project && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="max-w-[40vw] truncate text-sm text-muted-foreground" title={project.title}>
              {project.title}
            </span>
          </>
        )}

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-auto hidden h-8 w-full max-w-xs items-center gap-2 rounded-md border bg-muted/30 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex"
          aria-label="Open the command palette"
        >
          <Search className="size-3.5" />
          <span>Search projects, slides, actions…</span>
          <KbdGroup className="ml-auto">
            <Kbd>{MOD}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ModelStatus llm={llm} busy={studio.busy} onSettingsSaved={() => setLlmRefresh((n) => n + 1)} settingsOpen={settingsOpen} onSettingsOpenChange={setSettingsOpen} />
          {project && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={() => studio.openProject(null)}>
                  <Plus /> New video
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                New video <KbdGroup><Kbd>Alt</Kbd><Kbd>N</Kbd></KbdGroup>
              </TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderOpen /> Projects
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Recent projects</DropdownMenuLabel>
              {!recent.length && <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects yet. Describe a video to make your first one.</p>}
              {recent.slice(0, 12).map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => studio.openProject(p.id)} className="group/item flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {project?.id === p.id && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="open" />}
                      <span className="block truncate text-xs">{p.title}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="h-1 w-10 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${p.slideCount ? (p.approvedCount / p.slideCount) * 100 : 0}%` }} />
                      </span>
                      {p.approvedCount}/{p.slideCount} approved · {p.stage}
                      {p.updatedAt && <> · {formatDistanceToNowStrict(new Date(p.updatedAt), { addSuffix: true })}</>}
                    </span>
                  </span>
                  <button
                    aria-label={`Delete ${p.title}`}
                    className="rounded p-1 text-muted-foreground opacity-60 transition-opacity group-hover/item:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setToDelete(p);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => studio.openProject(null)}>
                <Plus /> New video
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPaletteOpen(true)}>
                <Search /> Search all projects…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}>
                <Keyboard />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Keyboard shortcuts <Kbd>?</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="22%" minSize="16%" maxSize="35%">
          <LibraryPanel
            registry={registry}
            theme={project?.theme ?? "midnight"}
            currentSpec={currentSpec}
            currentIndex={studio.previewIndex}
            onApply={studio.applyComponent}
            onApplyCard={studio.applyCard}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="50%" minSize="30%">
          {studio.loading ? <div className="pm-shimmer h-full" /> : <PreviewPanel studio={studio} registry={registry} recent={recent} />}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="28%" minSize="20%" maxSize="40%">
          <ChatPanel studio={studio} llmOnline={llm?.online ?? null} llmProvider={llm?.provider ?? "local"} />
        </ResizablePanel>
      </ResizablePanelGroup>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        studio={studio}
        recent={recent}
        onOpenModelSettings={() => setSettingsOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onDeleteProject={setToDelete}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the project, its slides, chat history and uploaded media. You can&apos;t undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteProject}>
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
