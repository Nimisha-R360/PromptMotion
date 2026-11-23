"use client";

import type { VideoPlan } from "@promptmotion/shared";
import {
  getDurationInFrames,
  Video,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "@promptmotion/video";
import { Player, type PlayerRef } from "@remotion/player";
import { type RefObject, useEffect } from "react";
import { logStep } from "@/lib/pipeline-log";

type PreviewStageProps = {
  /** Null until the first plan is ready. */
  plan: VideoPlan | null;
  playerRef: RefObject<PlayerRef | null>;
  /** Shown over the stage while something is running. */
  busyNote: string | null;
};

/** The center of the editor: the video, as large as the space allows. */
export function PreviewStage({ plan, playerRef, busyNote }: PreviewStageProps) {
  const durationInFrames = plan ? getDurationInFrames(plan, VIDEO_FPS) : 0;

  useEffect(() => {
    if (!plan) return;
    logStep("→ Remotion <Player> inputProps (what the video is drawn from)", {
      inputProps: plan,
      durationInFrames,
      fps: VIDEO_FPS,
      seconds: durationInFrames / VIDEO_FPS,
    });
  }, [plan, durationInFrames]);

  return (
    <section
      aria-label="Video preview"
      className="flex min-h-64 flex-1 items-center justify-center bg-zinc-900/60 p-4 sm:p-6"
    >
      <div
        className="relative aspect-video w-full"
        // Fit the frame inside the stage: as wide as possible without overflowing its height.
        style={{ maxWidth: "min(100%, calc((100dvh - 20rem) * 16 / 9))" }}
      >
        {plan ? (
          <div className="h-full overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-zinc-800">
            <Player
              ref={playerRef}
              component={Video}
              inputProps={plan}
              durationInFrames={durationInFrames}
              fps={VIDEO_FPS}
              compositionWidth={VIDEO_WIDTH}
              compositionHeight={VIDEO_HEIGHT}
              style={{ width: "100%", height: "100%" }}
              controls
              autoPlay
              loop
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 text-center text-sm text-zinc-500">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-8 text-zinc-600"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m10 9 5 3-5 3V9Z" />
            </svg>
            {busyNote ?? "Your video will appear here."}
          </div>
        )}

        {plan && busyNote ? (
          <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur">
            <span
              aria-hidden="true"
              className="size-3 animate-spin rounded-full border-2 border-zinc-500 border-t-white"
            />
            {busyNote}
          </div>
        ) : null}
      </div>
    </section>
  );
}
