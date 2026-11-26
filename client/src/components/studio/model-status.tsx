import { useEffect, useState } from "react";
import { Cloud, Cpu, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LlmStatus } from "@/lib/api";
import type { BusyState } from "@/hooks/use-studio";
import { ModelSettingsDialog } from "./model-settings";

export const PHASE_LABEL: Record<string, string> = {
  warming: "Warming up",
  thinking: "Thinking",
  planning: "Planning",
  revising: "Revising outline",
  designing: "Designing",
  redesigning: "Redesigning",
  editing: "Editing text",
  applying: "Applying component",
  theming: "Changing theme",
  splitting: "Splitting slide",
  answering: "Answering",
  validating: "Validating",
  narrating: "Writing voiceover",
  recording: "Recording voiceover",
  waiting: "Waiting for you",
};


/** Header badge: which model is loaded and what it is doing right now. */
export function ModelStatus({
  llm,
  busy,
  onSettingsSaved,
  settingsOpen: openProp,
  onSettingsOpenChange,
}: {
  llm: LlmStatus | null;
  busy: BusyState | null;
  onSettingsSaved?: () => void;
  /** optional control, so the command palette can open the model settings too */
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}) {
  const [now, setNow] = useState(() => 0);
  const [openState, setOpenState] = useState(false);
  const settingsOpen = openProp ?? openState;
  const setSettingsOpen = onSettingsOpenChange ?? setOpenState;
  const cloud = !!llm?.provider && llm.provider !== "local";
  const cloudName = llm?.provider === "anthropic" ? "Claude" : llm?.provider === "groq" ? "Groq" : "ChatGPT";
  const active = (busy?.phase && { phase: busy.phase, label: busy.status, startedAt: busy.startedAt }) || llm?.activity || null;
  const activeStart = active?.startedAt ?? null;
  useEffect(() => {
    if (activeStart == null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [activeStart]);

  let dot = "bg-muted-foreground";
  let text = "Checking model…";
  let tip = "Looking for the local llama.cpp server";
  if (llm && !llm.online) {
    dot = "bg-amber-400";
    text = "Model offline · rule-based";
    tip = "Start the model with: npm run llm";
    if (cloud) {
      text = `${cloudName} unavailable · rule-based`;
      tip = `${llm.error ?? `Check your ${cloudName} API key and model name.`} Click to open model settings.`;
    }
  } else if (active) {
    dot = "bg-primary";
    const secs = now ? Math.max(0, Math.round((now - active.startedAt) / 1000)) : 0;
    text = `${PHASE_LABEL[active.phase] ?? active.phase} · ${secs}s`;
    tip = active.label;
  } else if (llm?.online) {
    dot = "bg-emerald-400";
    text = llm.warm ? (cloud ? `${cloudName} · Ready` : "Ready") : "Loading design guide…";
    tip = llm.warm
      ? `${llm.model} is idle and its design guide is cached: requests start immediately`
      : `${llm.model} is pre-reading its design guide in the background (~40s once per server start)`;
    if (cloud) tip = `Agents run on ${cloudName} (${llm.model}). Click to change the model.`;
  }

  return (
    <>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Model settings"
          className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex"
        >
          {active ? <Loader2 className="size-3 animate-spin text-primary" /> : <span className={cn("size-1.5 rounded-full", dot)} />}
          {cloud ? <Cloud className="size-3.5" /> : <Cpu className="size-3.5" />}
          {llm?.model && <span className="hidden lg:inline">{llm.model} ·</span>}
          <span role="status" aria-live="polite" className={cn(active && "text-foreground")}>{text}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
    <ModelSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={onSettingsSaved} />
    </>
  );
}
