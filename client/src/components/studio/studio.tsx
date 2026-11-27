import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronDown, Clapperboard, Cpu, FolderOpen, Keyboard, Moon, MoreHorizontal, Plus, Search, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api, type LlmStatus, type Registry } from "@/lib/api";
import { useStudio } from "@/hooks/use-studio";
import type { ProjectSummary } from "@backend/lib/types";
import { SLOT_CATEGORY } from "@backend/runtime/types";
import { LibraryPanel, type LibraryCategory } from "./library-panel";
import { PreviewPanel } from "./preview-panel";
import { ChatFolded, ChatPanel } from "./chat-panel";
import { ModelStatus } from "./model-status";
import { CommandPalette, MOD, ShortcutsDialog } from "./command-palette";
import { ExportMenu } from "./export-menu";
import { PanelShell, ToolRail, type PanelId } from "./tool-rail";
import { SlidePanel } from "./slide-panel";
import { ThemePanel } from "./theme-panel";
import { VoicePanel } from "./voice-panel";

/** true while the user is typing somewhere, so single-key shortcuts don't steal their keystrokes */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.closest("[role=dialog],[role=listbox],[role=menu]"));

const CHAT_OPEN_KEY = "pm-chat-open";
/** The chat starts open, unless the user folded it last time (or the window is narrow). */
function initialChatOpen() {
  try {
    const saved = localStorage.getItem(CHAT_OPEN_KEY);
    if (saved) return saved === "1";
  } catch {
    /* storage blocked: use the default */
  }
  return typeof window === "undefined" || window.innerWidth >= 1100;
}

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
  // the side panel the tool rail opened (one at a time), the library's open category, and the chat column
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [libraryCategory, setLibraryCategory] = useState<LibraryCategory>(null);
  const [chatOpen, setChatOpenState] = useState(initialChatOpen);
  const setChatOpen = (open: boolean) => {
    setChatOpenState(open);
    try {
      localStorage.setItem(CHAT_OPEN_KEY, open ? "1" : "0");
    } catch {
      /* storage blocked: remembered for this visit only */
    }
  };

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
  // without an open video only the library makes sense
  const shownPanel = panel && (project || panel === "library") ? panel : null;

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

  // global shortcuts: ⌘K palette, / focus message, ←/→ slides, Alt+N new video, Esc stop or close the panel, ? help
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
      } else if (e.key === "Escape" && panel) {
        setPanel(null);
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && project?.slides.length) {
        e.preventDefault();
        const next = Math.min(project.slides.length - 1, Math.max(0, studio.previewIndex + (e.key === "ArrowLeft" ? -1 : 1)));
        studio.setPreviewIndex(next);
        studio.setScope("slide");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, project, panel]);

  const openLibrary = (category: LibraryCategory) => {
    setLibraryCategory(category);
    setPanel("library");
  };
  const slideLabel = `Slide ${studio.previewIndex + 1}`;
  const panelView: Record<PanelId, { title: string; subtitle?: string; body: React.ReactNode }> = {
    library: {
      title: "Library",
      subtitle: currentSpec ? `for slide ${studio.previewIndex + 1}` : undefined,
      body: (
        <LibraryPanel
          registry={registry}
          theme={project?.theme ?? "midnight"}
          currentSpec={currentSpec}
          currentIndex={studio.previewIndex}
          onApply={studio.applyComponent}
          onApplyCard={studio.applyCard}
          category={libraryCategory}
          onCategoryChange={setLibraryCategory}
        />
      ),
    },
    slide: {
      title: "Slide settings",
      subtitle: slideLabel,
      body: (
        <SlidePanel
          studio={studio}
          registry={registry}
          onChangeSlot={(slot) => openLibrary(SLOT_CATEGORY[slot] === "scene" ? "remocn" : SLOT_CATEGORY[slot])}
          onChangeCard={() => openLibrary("card")}
        />
      ),
    },
    voice: {
      title: "Voiceover",
      subtitle: slideLabel,
      body: project && <VoicePanel key={`${studio.previewIndex}:${currentSpec?.narration ?? ""}`} studio={studio} index={studio.previewIndex} />,
    },
    theme: {
      title: "Theme",
      subtitle: "the whole video",
      body: <ThemePanel registry={registry} value={project?.theme ?? ""} onPick={studio.setTheme} disabled={!!studio.busy} />,
    },
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b px-3">
        <button
          onClick={() => studio.openProject(null)}
          className="flex items-center gap-2 rounded-md px-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Prompt Motion: home"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Clapperboard className="size-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight md:inline">Prompt Motion</span>
        </button>
        <span className="text-muted-foreground/40" aria-hidden>
          /
        </span>

        {/* the open video; its menu lists the other projects */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="max-w-[40vw] gap-1.5 font-medium" aria-label={project ? `${project.title}: switch project` : "Projects"}>
              {project ? (
                <span className="truncate">{project.title}</span>
              ) : (
                <>
                  <FolderOpen /> Projects
                </>
              )}
              <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
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
                    {p.approvedCount}/{p.slideCount} approved
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
              <Plus /> New video <DropdownMenuShortcut>Alt N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPaletteOpen(true)}>
              <Search /> Search all projects…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2">
          <ModelStatus llm={llm} busy={studio.busy} onSettingsSaved={() => setLlmRefresh((n) => n + 1)} settingsOpen={settingsOpen} onSettingsOpenChange={setSettingsOpen} />
          {project && <ExportMenu project={project} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="More options">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={() => setPaletteOpen(true)}>
                <Search /> Search projects, slides, actions <DropdownMenuShortcut>{MOD} K</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                <Cpu /> AI model settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                {resolvedTheme === "dark" ? <Sun /> : <Moon />} {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                <Keyboard /> Keyboard shortcuts <DropdownMenuShortcut>?</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ToolRail active={shownPanel} onPick={setPanel} hasProject={!!project} hasSlide={!!currentSpec} onNew={() => studio.openProject(null)} />
        {shownPanel && (
          <PanelShell title={panelView[shownPanel].title} subtitle={panelView[shownPanel].subtitle} onClose={() => setPanel(null)}>
            {panelView[shownPanel].body}
          </PanelShell>
        )}
        <main className="min-w-0 flex-1">
          {studio.loading ? <div className="pm-shimmer h-full" /> : <PreviewPanel studio={studio} registry={registry} recent={recent} onOpenPanel={setPanel} />}
        </main>
        {chatOpen ? (
          <div className="w-[340px] shrink-0 border-l xl:w-[380px]">
            <ChatPanel studio={studio} llmOnline={llm?.online ?? null} llmProvider={llm?.provider ?? "local"} onFold={() => setChatOpen(false)} />
          </div>
        ) : (
          <ChatFolded studio={studio} onOpen={() => setChatOpen(true)} />
        )}
      </div>

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
