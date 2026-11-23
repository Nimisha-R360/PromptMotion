"use client";

import { useEffect, useRef, useState } from "react";

export type ThreadEntry = {
  id: number;
  kind: "prompt" | "feedback";
  text: string;
  state: "running" | "done" | "failed";
  /** Progress, result ("Version 2 ready · …") or error. */
  note: string;
};

const EXAMPLE_PROMPTS = [
  "A 30-second explainer on how vaccines work",
  "A launch teaser for a budgeting app",
  "Five tips for better sleep",
];
const FEEDBACK_SUGGESTIONS = [
  "Make it shorter",
  "Make it more playful",
  "Add a closing title scene",
];

type AssistantPanelProps = {
  thread: ThreadEntry[];
  /** prompt: no video yet. feedback: messages revise the current video. */
  mode: "prompt" | "feedback";
  running: boolean;
  onSend: (text: string) => void;
};

function EntryNote({ entry }: { entry: ThreadEntry }) {
  const color =
    entry.state === "failed"
      ? "text-red-400"
      : entry.state === "done"
        ? "text-emerald-400"
        : "text-zinc-400";
  return (
    <div className={`flex items-start gap-2 text-xs ${color}`}>
      {entry.state === "running" ? (
        <span
          aria-hidden="true"
          className="mt-0.5 size-3 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200"
        />
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="mt-0.5 size-3 shrink-0"
        >
          {entry.state === "done" ? <path d="m3 8.5 3 3 7-7" /> : <path d="m4 4 8 8M12 4l-8 8" />}
        </svg>
      )}
      <span role={entry.state === "failed" ? "alert" : undefined}>{entry.note}</span>
    </div>
  );
}

/** The right-hand panel: a conversation where the first message makes the video. */
export function AssistantPanel({ thread, mode, running, onSend }: AssistantPanelProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const canSend = text.trim().length > 0 && !running;
  const chips = mode === "prompt" ? EXAMPLE_PROMPTS : FEEDBACK_SUGGESTIONS;

  // Keep the newest message in view.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [thread]);

  const send = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <aside
      aria-label="Assistant"
      className="flex min-h-[28rem] flex-col border-t border-zinc-800 bg-zinc-950 lg:min-h-0 lg:w-[24rem] lg:border-t-0 lg:border-l"
    >
      <div className="flex h-11 shrink-0 items-center border-b border-zinc-800 px-4 text-sm font-medium">
        Assistant
      </div>

      <div ref={threadRef} className="flex-1 space-y-5 overflow-y-auto p-4">
        {thread.length === 0 ? (
          <div className="space-y-2 pt-2">
            <h1 className="text-lg font-semibold tracking-tight">
              What should your video be about?
            </h1>
            <p className="text-sm text-zinc-400">
              Describe it in a sentence or two. Once it&apos;s made, tell me what to change and
              I&apos;ll make a new version.
            </p>
          </div>
        ) : (
          thread.map((entry) => (
            <div key={entry.id} className="space-y-2">
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] tracking-wide text-zinc-500 uppercase">
                  {entry.kind === "prompt" ? "Prompt" : "Feedback"}
                </span>
                <p className="max-w-[90%] rounded-2xl rounded-br-md bg-zinc-800 px-3.5 py-2 text-sm whitespace-pre-wrap text-zinc-100">
                  {entry.text}
                </p>
              </div>
              <EntryNote entry={entry} />
            </div>
          ))
        )}
      </div>

      <form
        className="shrink-0 space-y-2 border-t border-zinc-800 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div
          className="flex flex-wrap gap-1.5"
          aria-label={mode === "prompt" ? "Example prompts" : "Feedback ideas"}
        >
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setText(chip);
                textareaRef.current?.focus();
              }}
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 transition focus-within:border-zinc-600">
          <label htmlFor="assistant-input" className="sr-only">
            {mode === "prompt" ? "Describe your video" : "What should change?"}
          </label>
          <textarea
            id="assistant-input"
            ref={textareaRef}
            value={text}
            maxLength={mode === "prompt" ? 4000 : 2000}
            rows={3}
            placeholder={
              mode === "prompt"
                ? "Describe your video…"
                : "What should change? e.g. Make it shorter"
            }
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                send();
              }
            }}
            className="block max-h-40 w-full resize-none bg-transparent px-3 pt-2.5 text-sm leading-relaxed outline-none placeholder:text-zinc-500"
          />
          <div className="flex items-center justify-between px-3 pt-1 pb-2">
            <span className="text-[11px] text-zinc-600">Ctrl or ⌘ + Enter</span>
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              {running ? "Working…" : mode === "prompt" ? "Generate" : "Apply feedback"}
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
