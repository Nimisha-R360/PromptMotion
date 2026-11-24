"use client";
import { useEffect, useState } from "react";
import { Clapperboard, FolderOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, type LlmStatus, type Registry } from "@/lib/client/api";
import { useStudio } from "@/hooks/use-studio";
import type { ProjectSummary } from "@/lib/types";
import { LibraryPanel } from "./library-panel";
import { PreviewPanel } from "./preview-panel";
import { ChatPanel } from "./chat-panel";
import { ModelStatus } from "./model-status";

export function Studio() {
  const studio = useStudio();
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [llm, setLlm] = useState<LlmStatus | null>(null);
  const [recent, setRecent] = useState<ProjectSummary[]>([]);

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
        <div className="ml-auto flex items-center gap-2">
          <ModelStatus llm={llm} busy={studio.busy} onSettingsSaved={() => setLlmRefresh((n) => n + 1)} />
          {project && (
            <Button size="sm" onClick={() => studio.openProject(null)}>
              <Plus /> New video
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderOpen /> Projects
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Recent projects</DropdownMenuLabel>
              {!recent.length && <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects yet.</p>}
              {recent.slice(0, 12).map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => studio.openProject(p.id)} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{p.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.approvedCount}/{p.slideCount} approved · {p.stage}
                    </span>
                  </span>
                  <button
                    aria-label={`Delete ${p.title}`}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!confirm(`Delete “${p.title}”?`)) return;
                      await api.remove(p.id).catch((err) => toast.error(err.message));
                      setRecent((r) => r.filter((x) => x.id !== p.id));
                      if (project?.id === p.id) studio.openProject(null);
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
            </DropdownMenuContent>
          </DropdownMenu>
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
        <ResizableHandle />
        <ResizablePanel defaultSize="50%" minSize="30%">
          {studio.loading ? <div className="pm-shimmer h-full" /> : <PreviewPanel studio={studio} registry={registry} recent={recent} />}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="28%" minSize="20%" maxSize="40%">
          <ChatPanel studio={studio} llmOnline={llm?.online ?? null} llmProvider={llm?.provider ?? "local"} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
