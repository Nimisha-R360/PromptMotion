"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, streamProject } from "@/lib/client/api";
import type { Project } from "@/lib/types";

export interface BusyState {
  kind: "outline" | "slide" | "upload" | "create" | "agent";
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
  const router = useRouter();
  const search = useSearchParams();
  const projectId = search.get("p");
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
        router.replace("/");
      })
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openProject = useCallback((id: string | null) => router.replace(id ? `/?p=${id}` : "/"), [router]);

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
    async (prompt: string) => {
      setBusy({ kind: "create", status: "Creating project…", tokens: 0, startedAt: Date.now() });
      try {
        const p = await api.create(prompt);
        setProject(p);
        router.replace(`/?p=${p.id}`);
        setBusy(null);
        // the agent reads the request and plans the outline (the prompt is already in the chat)
        await runAgent(p, prompt, 0, false);
      } catch (e) {
        toast.error((e as Error).message);
        setBusy(null);
      }
    },
    [router, runAgent],
  );

  const upload = useCallback(
    async (files: File[], instructions?: string) => {
      setBusy({ kind: "upload", status: `Reading ${files.length > 1 ? `${files.length} files` : files[0].name}…`, tokens: 0, startedAt: Date.now() });
      try {
        const p = await api.upload(files, instructions);
        setProject(p);
        setPreviewIndex(0);
        router.replace(`/?p=${p.id}`);
        setBusy(null);
        // images / clips sent with a request: the agent plans the video around them and writes the text from the request
        if (p.mode === "prompt" && p.stage === "outline" && instructions) await runAgent(p, instructions, 0, false, p.media.map((m) => m.ref));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [router, runAgent],
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
        if (!project) return upload(media, t || undefined);
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
    async (slot: string, componentId: string) => {
      if (!project) return;
      const slide = project.slides[previewIndex];
      if (!slide?.spec) {
        toast.error("Design this slide first, then apply components to it.");
        return;
      }
      try {
        const p = await api.patchSlide(project.id, previewIndex, { animations: { [slot]: componentId } });
        setProject(p);
        setScope("slide");
        toast.success(`Applied to slide ${previewIndex + 1} · ${slot}`);
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
    setSlideStyle,
    setTheme,
    cancel,
  };
}

export type Studio = ReturnType<typeof useStudio>;
