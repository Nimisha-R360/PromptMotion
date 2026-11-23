"use client";

import type { ProjectResponse, VideoPlan } from "@promptmotion/shared";
import type { PlayerRef } from "@remotion/player";
import { useRef, useState } from "react";
import { createProject, createRevision } from "@/lib/api";
import { logStep } from "@/lib/pipeline-log";
import { errorText, pollProject, statusText } from "@/lib/project-runs";
import { AssistantPanel, type ThreadEntry } from "./AssistantPanel";
import { PreviewStage } from "./PreviewStage";
import { SceneTimeline } from "./SceneTimeline";
import { TopBar } from "./TopBar";

type Current = { projectId: string; plan: VideoPlan; version: number };

const describeVersion = (project: ProjectResponse) => {
  const scenes = project.plan?.scenes ?? [];
  const seconds = scenes.reduce((total, scene) => total + scene.durationSec, 0);
  return `Version ${project.planVersion} ready · ${scenes.length} scenes · ${seconds.toFixed(0)}s`;
};

/**
 * The editor screen: video in the middle, timeline below, assistant on the right.
 * The first message makes a video; every later message is feedback that makes a new version.
 */
export function EditorApp() {
  const [current, setCurrent] = useState<Current | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [running, setRunning] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const nextEntryId = useRef(0);

  const addEntry = (kind: ThreadEntry["kind"], text: string) => {
    const id = nextEntryId.current++;
    setThread((entries) => [...entries, { id, kind, text, state: "running", note: "Sending…" }]);
    return (patch: Partial<ThreadEntry>) =>
      setThread((entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      );
  };

  const showPlan = (project: ProjectResponse) => {
    if (project.plan && project.planVersion) {
      setCurrent({ projectId: project.id, plan: project.plan, version: project.planVersion });
    }
  };

  const generate = async (prompt: string) => {
    const update = addEntry("prompt", prompt);
    try {
      logStep("1. Prompt typed in the browser", { prompt });
      const { projectId } = await createProject(prompt);
      logStep("2. POST /projects → API answered", { projectId });

      const project = await pollProject(
        projectId,
        (p) => p.status === "failed" || (p.status === "ready" && p.plan !== null),
        (p) => update({ note: statusText(p.status, false) }),
        "3.",
      );
      if (project.status === "failed") {
        update({ state: "failed", note: project.error ?? statusText("failed", false) });
        return;
      }
      logStep("4. GET /projects/:id → plan read from the database", project.plan);
      showPlan(project);
      update({ state: "done", note: describeVersion(project) });
    } catch (error) {
      update({ state: "failed", note: errorText(error) });
    }
  };

  const revise = async (target: Current, feedback: string) => {
    const update = addEntry("feedback", feedback);
    try {
      logStep("5. Feedback typed in the browser", { feedback, aboutVersion: target.version });
      const { basedOnVersion } = await createRevision(target.projectId, feedback);
      logStep("6. POST /projects/:id/revisions → API answered", {
        projectId: target.projectId,
        basedOnVersion,
      });

      const project = await pollProject(
        target.projectId,
        (p) =>
          p.status === "failed" ||
          (p.status === "ready" && ((p.planVersion ?? 0) > basedOnVersion || p.error !== null)),
        (p) => update({ note: statusText(p.status, true) }),
        "7.",
      );
      if ((project.planVersion ?? 0) <= basedOnVersion) {
        update({ state: "failed", note: project.error ?? "The video didn't change." });
        return;
      }
      logStep(`8. Version ${project.planVersion} read from the database`, project.plan);
      showPlan(project);
      update({ state: "done", note: describeVersion(project) });
    } catch (error) {
      update({ state: "failed", note: errorText(error) });
    }
  };

  const send = async (text: string) => {
    setRunning(true);
    try {
      await (current ? revise(current, text) : generate(text));
    } finally {
      setRunning(false);
    }
  };

  const startOver = () => {
    setCurrent(null);
    setThread([]);
  };

  const lastEntry = thread.at(-1);
  const runningNote = running && lastEntry ? lastEntry.note : null;

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-100 lg:h-dvh">
      <TopBar
        title={current?.plan.title ?? null}
        version={current?.version ?? null}
        status={runningNote ?? (current ? "Ready" : null)}
        running={running}
        canStartOver={!running && (current !== null || thread.length > 0)}
        onStartOver={startOver}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PreviewStage plan={current?.plan ?? null} playerRef={playerRef} busyNote={runningNote} />
          <SceneTimeline plan={current?.plan ?? null} playerRef={playerRef} />
        </main>
        <AssistantPanel
          thread={thread}
          mode={current ? "feedback" : "prompt"}
          running={running}
          onSend={send}
        />
      </div>
    </div>
  );
}
