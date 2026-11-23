"use client";

import type { Scene, VideoPlan } from "@promptmotion/shared";
import { getSceneDurationInFrames, VIDEO_FPS } from "@promptmotion/video";
import type { PlayerRef } from "@remotion/player";
import { type RefObject, useEffect, useState } from "react";
import { formatTime } from "@/lib/project-runs";

const SCENE_STYLE: Record<Scene["type"], { label: string; className: string }> = {
  title: { label: "Title", className: "border-blue-500/60 bg-blue-900/70" },
  bullets: { label: "Bullets", className: "border-emerald-500/60 bg-emerald-900/70" },
  dialogue: { label: "Dialogue", className: "border-orange-500/60 bg-orange-900/70" },
};

const sceneSummary = (scene: Scene) => {
  switch (scene.type) {
    case "title":
    case "bullets":
      return scene.heading;
    case "dialogue":
      return scene.lines[0] ? `${scene.lines[0].speaker}: ${scene.lines[0].text}` : "";
  }
};

/** Seconds between ruler labels, so a short or long video both get a readable ruler. */
const tickStep = (totalSec: number) =>
  totalSec <= 20 ? 2 : totalSec <= 60 ? 5 : totalSec <= 120 ? 10 : 30;

type SceneTimelineProps = {
  plan: VideoPlan | null;
  playerRef: RefObject<PlayerRef | null>;
};

/**
 * Read-only view of the plan as an editor timeline. Clicking a scene jumps the preview to it;
 * nothing here changes the video.
 */
export function SceneTimeline({ plan, playerRef }: SceneTimelineProps) {
  const [frame, setFrame] = useState(0);

  // Follow the player so the playhead and time stay in sync.
  useEffect(() => {
    const player = playerRef.current;
    if (!plan || !player) return;
    const onFrame = ({ detail }: { detail: { frame: number } }) => setFrame(detail.frame);
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [plan, playerRef]);

  const segments: { scene: Scene; from: number; frames: number }[] = [];
  for (const scene of plan?.scenes ?? []) {
    const previous = segments.at(-1);
    segments.push({
      scene,
      from: previous ? previous.from + previous.frames : 0,
      frames: getSceneDurationInFrames(scene, VIDEO_FPS),
    });
  }
  const totalFrames = segments.reduce((total, segment) => total + segment.frames, 0);
  const totalSec = totalFrames / VIDEO_FPS;
  const step = tickStep(totalSec);
  const ticks = totalFrames
    ? Array.from({ length: Math.floor(totalSec / step) + 1 }, (_, i) => i * step)
    : [];
  const shownFrame = Math.min(frame, Math.max(totalFrames - 1, 0));
  const percent = (frames: number) => (totalFrames ? (frames / totalFrames) * 100 : 0);

  return (
    <section
      aria-label="Timeline"
      className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-4 py-3"
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-300">Timeline</span>
        <span className="text-zinc-500 tabular-nums">
          {formatTime(plan ? shownFrame / VIDEO_FPS : 0)} / {formatTime(totalSec)}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex w-14 shrink-0 flex-col gap-1.5 pt-5 text-[11px] text-zinc-500">
          <div className="flex h-12 items-center">Scenes</div>
          <div className="flex h-8 items-center">Voice</div>
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Ruler */}
          <div className="relative mb-1 h-4 text-[10px] text-zinc-600 tabular-nums">
            {ticks.map((second) => (
              <span
                key={second}
                className="absolute -translate-x-1/2 first:translate-x-0"
                style={{ left: `${percent(second * VIDEO_FPS)}%` }}
              >
                {second}s
              </span>
            ))}
          </div>

          {plan ? (
            <>
              <div className="flex h-12">
                {segments.map(({ scene, from, frames }, index) => {
                  const style = SCENE_STYLE[scene.type];
                  const active = shownFrame >= from && shownFrame < from + frames;
                  return (
                    <div key={scene.id} className="px-px" style={{ width: `${percent(frames)}%` }}>
                      <button
                        type="button"
                        title={`Jump to scene ${index + 1}`}
                        onClick={() => playerRef.current?.seekTo(from)}
                        className={`flex h-full w-full flex-col justify-center overflow-hidden rounded border px-2 text-left transition hover:brightness-125 ${style.className} ${active ? "ring-1 ring-white/70" : ""}`}
                      >
                        <span className="flex items-center justify-between gap-2 text-[10px] tracking-wide text-white/60 uppercase">
                          <span className="truncate">
                            {index + 1} · {style.label}
                          </span>
                          <span className="shrink-0 tabular-nums">{scene.durationSec}s</span>
                        </span>
                        <span className="truncate text-xs text-white">{sceneSummary(scene)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-1.5 flex h-8">
                {segments.map(({ scene, frames }) => (
                  <div key={scene.id} className="px-px" style={{ width: `${percent(frames)}%` }}>
                    <div className="flex h-full items-center overflow-hidden rounded border border-zinc-800 bg-zinc-900 px-2">
                      <span className="truncate text-[11px] text-zinc-400 italic">
                        {scene.narration ?? "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-4 bottom-0 w-px bg-white"
                style={{ left: `${percent(shownFrame)}%` }}
              >
                <span className="absolute -top-1 -left-1 size-2 rotate-45 bg-white" />
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 items-center rounded border border-dashed border-zinc-800 px-3 text-xs text-zinc-600">
                Scenes appear here after you generate a video.
              </div>
              <div className="mt-1.5 h-8 rounded border border-dashed border-zinc-800" />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
