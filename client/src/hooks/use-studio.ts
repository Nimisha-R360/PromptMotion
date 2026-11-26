import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParam } from "@/hooks/use-search-param";
import { toast } from "sonner";
import { api, streamProject } from "@/lib/api";
import type { Project, SlideTextPatch } from "@backend/lib/types";
import type { StartOptions } from "@backend/lib/start-options";
import type { VoiceSettings } from "@backend/lib/voice/voices";

export interface BusyState {
  kind: "outline" | "slide" | "upload" | "create" | "agent" | "voice";
  /** tool the Director agent is currently running */
  tool?: string;
  index?: number;
  status: string;
  /** model phase reported by the server: planning, designing, redesigning, validating… */
  phase?: string;
  tokens: number;
  startedAt: number;
}

/**
 * A message that describes a whole new video (e.g. "A 6-slide explainer video about …" or a "Slide 1: … Slide 2: …" brief)
 * — sent inside an open project it must start a new project, not become feedback for the slide in view.
 */
const NEW_VIDEO_RE = /\b(video|presentation|deck|explainer|slideshow)\s+(about|on|for|explaining)\b/i;
export const isNewVideoRequest = (t: string) => t.length >= 100 && (NEW_VIDEO_RE.test(t) || (t.match(/\bslide\s*\d+\s*:/gi)?.length ?? 0) >= 2);

const AFFIRMATIVE = /^(y|yes|yep|ok|okay|approve|approved|looks good|look good|lgtm|great|perfect|next|good|nice|love it|ship it|👍|✅)\b[\s!.]*$/i;

export function useStudio() {
  const [projectId, setProjectId] = useSearchParam("p");
  const [project, setProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState<BusyState | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [scope, setScope] = useState<"slide" | "all">("slide");
  const abortRef = useRef<AbortController | null>(null);

  // load project from URL
  useEffect(() => {
    if (!projectId || project?.id === projectId) return;
    let cancelled = false;
    api
      .project(projectId)
      .then((p) => {
        if (cancelled) return;
        setProject(p);
        setPreviewIndex(p.currentIndex);
        setScope(p.stage === "complete" ? "all" : "slide");
      })
      .catch((e) => {
        toast.error(e.message);
        setProjectId(null);
      })
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // opening / leaving a project adds a history entry, so the browser Back button returns to where you were
  const openProject = useCallback((id: string | null) => setProjectId(id, { push: true }), [setProjectId]);

  const run = useCallback(
    async (state: Omit<BusyState, "tokens" | "startedAt">, url: string, body: unknown) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy({ ...state, tokens: 0, startedAt: Date.now() });
      try {
        const p = await streamProject(
          url,
          body,
          {
            onStatus: (status, phase) => setBusy((b) => (b ? { ...b, status, phase } : b)),
            onProgress: (tokens) => setBusy((b) => (b ? { ...b, tokens } : b)),
            onTool: (tool) => setBusy((b) => (b ? { ...b, tool } : b)),
          },
          ac.signal,
        );
        setProject(p);
        return p;
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
        // refresh to show any partial state
        const id = (body as { projectId?: string })?.projectId;
        if (id) api.project(id).then(setProject).catch(() => {});
        return null;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const runOutline = useCallback(
    (p: Project, feedback?: string) =>
      run({ kind: "outline", status: "Planning your video…", phase: feedback ? "revising" : "planning" }, `/api/projects/${p.id}/outline`, { feedback, projectId: p.id }),
    [run],
  );

  const generate = useCallback(
    async (p: Project, index: number, feedback?: string) => {
      setPreviewIndex(index);
      setScope("slide");
      return run(
        { kind: "slide", index, status: `Designing slide ${index + 1}…`, phase: feedback ? "redesigning" : "designing" },
        `/api/projects/${p.id}/slides/${index}/generate`,
        { feedback, projectId: p.id },
      );
    },
    [run],
  );

  /** One chat turn handled by the Director agent (Strands): it picks and runs the tools, then waits for the user. */
  const runAgent = useCallback(
    async (p: Project, message: string, slide: number, record = true, media?: string[]) => {
      const res = await run(
        { kind: "agent", status: media?.length ? "Placing your media…" : "Understanding your request…", phase: "thinking" },
        `/api/projects/${p.id}/agent`,
        { message, slide, record, projectId: p.id, ...(media?.length ? { media } : {}) },
      );
      if (res) {
        setPreviewIndex(res.currentIndex);
        setScope("slide");
      }
      return res;
    },
    [run],
  );

  const start = useCallback(
    async (prompt: string, options?: StartOptions) => {
      setBusy({ kind: "create", status: "Creating project…", tokens: 0, startedAt: Date.now() });
      try {
        const p = await api.create(prompt, options);
        setProject(p);
        setProjectId(p.id, { push: true });
        setBusy(null);
        // the agent reads the request and plans the outline (the prompt is already in the chat)
        await runAgent(p, prompt, 0, false);
      } catch (e) {
        toast.error((e as Error).message);
        setBusy(null);
      }
    },
    [setProjectId, runAgent],
  );

  const upload = useCallback(
    async (files: File[], instructions?: string) => {
      setBusy({ kind: "upload", status: `Reading ${files.length > 1 ? `${files.length} files` : files[0].name}…`, tokens: 0, startedAt: Date.now() });
      try {
        const p = await api.upload(files, instructions);
        setProject(p);
        setPreviewIndex(0);
        setProjectId(p.id, { push: true });
        setBusy(null);
        // images / clips sent with a request: the agent plans the video around them and writes the text from the request
        if (p.mode === "prompt" && p.stage === "outline" && instructions) await runAgent(p, instructions, 0, false, p.media.map((m) => m.ref));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [setProjectId, runAgent],
  );

  const approveOutline = useCallback(async () => {
    if (!project) return;
    try {
      const p = await api.approveOutline(project.id);
      setProject(p);
      await generate(p, 0);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [project, generate]);

  const approveSlide = useCallback(
    async (index: number) => {
      if (!project) return;
      try {
        const p = await api.approveSlide(project.id, index);
        setProject(p);
        const next = p.slides.find((s) => s.status !== "approved");
        if (!next) {
          setScope("all");
          toast.success("Video complete — every slide approved");
          return;
        }
        if (!next.spec) await generate(p, next.index);
        else setPreviewIndex(next.index);
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [project, generate],
  );

  const redesign = useCallback((index: number, feedback: string) => project && generate(project, index, feedback || "Try a noticeably different design."), [project, generate]);

  /** Chat input dispatcher: meaning depends on the workflow stage. `media`: images / video clips attached to the message. */
  const send = useCallback(
    async (text: string, media: File[] = []) => {
      const t = text.trim();
      if (media.length) {
        // a whole new video described with the files → a new project built around them (not this project's slide)
        if (!project || isNewVideoRequest(t)) {
          if (project) toast.info("That looks like a new video request: starting a new project with your files.");
          return upload(media, t || undefined);
        }
        setBusy({ kind: "upload", status: `Uploading ${media.length > 1 ? `${media.length} files` : media[0].name}…`, tokens: 0, startedAt: Date.now() });
        let refs: string[];
        try {
          const res = await api.attachMedia(project.id, media);
          refs = res.refs;
          setProject(res.project);
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(null);
          return;
        }
        setBusy(null);
        return runAgent(project, t || `Use the attached ${media.length > 1 ? "files" : "file"} on slide ${previewIndex + 1}`, previewIndex, true, refs);
      }
      if (!t) return;
      if (!project) return start(t);
      if (isNewVideoRequest(t)) {
        toast.info("That looks like a new video request: starting a new project for it.");
        return start(t);
      }
      // fast path: a plain "yes / approve" needs no model call — same effect as the Approve button
      if (AFFIRMATIVE.test(t)) {
        if (project.stage === "outline_review") return approveOutline();
        if (project.slides[previewIndex]?.status === "review") return approveSlide(previewIndex);
      }
      // everything else is understood and acted on by the Director agent
      return runAgent(project, t, previewIndex);
    },
    [project, start, upload, approveOutline, approveSlide, runAgent, previewIndex],
  );

  const applyComponent = useCallback(
    /** `layout`: also switch the slide's layout (a chart on a slide with numbers makes it a chart slide) */
    async (slot: string, componentId: string, layout?: string) => {
      if (!project) return;
      const slide = project.slides[previewIndex];
      if (!slide?.spec) {
        toast.error("Design this slide first, then apply components to it.");
        return;
      }
      try {
        const p = await api.patchSlide(project.id, previewIndex, { animations: { [slot]: componentId }, ...(layout ? { layout } : {}) });
        setProject(p);
        setScope("slide");
        toast.success(`Applied to slide ${previewIndex + 1} · ${slot}${layout === "chart" ? " (now a chart slide)" : ""}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [project, previewIndex],
  );

  /** Library → Cards: draw an Onda card on the current slide (null removes it). No model call. */
  const applyCard = useCallback(
    async (card: string | null, name?: string) => {
      if (!project?.slides[previewIndex]?.spec) {
        toast.error("Design this slide first, then add a card to it.");
        return;
      }
      try {
        setProject(await api.patchSlide(project.id, previewIndex, { card }));
        setScope("slide");
        toast.success(card ? `Added the ${name ?? "card"} to slide ${previewIndex + 1}` : `Removed the card from slide ${previewIndex + 1}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [project, previewIndex],
  );

  const setSlideStyle = useCallback(
    async (style: string) => {
      if (!project?.slides[previewIndex]?.spec) return;
      try {
        setProject(await api.patchSlide(project.id, previewIndex, { style }));
        setScope("slide");
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [project, previewIndex],
  );

  /** Click-to-edit: save the words typed in the text editor (no model call). Returns true when saved. */
  const editSlideText = useCallback(
    async (index: number, text: SlideTextPatch) => {
      if (!project?.slides[index]?.spec) return false;
      try {
        setProject(await api.patchSlide(project.id, index, { text }));
        toast.success(`Slide ${index + 1} text saved`);
        return true;
      } catch (e) {
        toast.error((e as Error).message);
        return false;
      }
    },
    [project],
  );

  const setTheme = useCallback(
    async (theme: string) => {
      if (!project) return;
      try {
        setProject(await api.patch(project.id, { theme }));
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [project],
  );

  /**
   * Voiceover: write (when missing, or `rewrite`) and record slide `index`'s narration, or every designed slide's when
   * `index` is left out. Runs the local voice model on the server; progress shows like a slide design.
   */
  const makeVoiceover = useCallback(
    (index?: number, rewrite = false) => {
      if (!project) return Promise.resolve(null);
      const what = index == null ? "every slide" : `slide ${index + 1}`;
      return run(
        { kind: "voice", index, status: rewrite ? `Rewriting the voiceover for ${what}…` : `Making the voiceover for ${what}…`, phase: "narrating" },
        `/api/projects/${project.id}/voice`,
        { index, rewrite, projectId: project.id },
      );
    },
    [project, run],
  );

  /** Voiceover settings. Switching it on records every designed slide right away. */
  const setVoiceover = useCallback(
    async (patch: Partial<VoiceSettings>) => {
      if (!project) return;
      try {
        const p = await api.patch(project.id, { voiceover: patch });
        setProject(p);
        const changed = patch.on || (p.voiceover.on && (patch.voice !== undefined || patch.speed !== undefined));
        if (changed && p.slides.some((s) => s.spec)) await makeVoiceover();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [project, makeVoiceover],
  );

  /** Save the narration typed for slide `index` and, with voiceover on, record it again. Returns true when saved. */
  const editNarration = useCallback(
    async (index: number, narration: string) => {
      if (!project?.slides[index]?.spec) return false;
      try {
        const p = await api.patchSlide(project.id, index, { text: { narration } });
        setProject(p);
        if (p.voiceover.on && narration.trim()) await makeVoiceover(index);
        return true;
      } catch (e) {
        toast.error((e as Error).message);
        return false;
      }
    },
    [project, makeVoiceover],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  // the URL is the source of truth for which project is open
  const visible = projectId ? project : null;
  return {
    project: visible,
    loading: !!projectId && project?.id !== projectId && !busy,
    busy,
    previewIndex,
    setPreviewIndex,
    scope,
    setScope,
    openProject,
    start,
    upload,
    runOutline: (feedback?: string) => project && runOutline(project, feedback),
    approveOutline,
    generate: (index: number, feedback?: string) => project && generate(project, index, feedback),
    approveSlide,
    redesign,
    send,
    applyComponent,
    applyCard,
    makeVoiceover,
    setVoiceover,
    editNarration,
    setSlideStyle,
    editSlideText,
    setTheme,
    cancel,
  };
}

export type Studio = ReturnType<typeof useStudio>;
