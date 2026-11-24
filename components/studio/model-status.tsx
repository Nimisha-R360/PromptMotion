"use client";
import { useEffect, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LlmStatus } from "@/lib/client/api";
import type { BusyState } from "@/hooks/use-studio";

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
  waiting: "Waiting for you",
};


/** Header badge: which model is loaded and what it is doing right now. */
export function ModelStatus({ llm, busy }: { llm: LlmStatus | null; busy: BusyState | null }) {
  const [now, setNow] = useState(() => 0);
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
  } else if (active) {
    dot = "bg-primary";
    const secs = now ? Math.max(0, Math.round((now - active.startedAt) / 1000)) : 0;
    text = `${PHASE_LABEL[active.phase] ?? active.phase} · ${secs}s`;
    tip = active.label;
  } else if (llm?.online) {
    dot = "bg-emerald-400";
    text = llm.warm ? "Ready" : "Loading design guide…";
    tip = llm.warm
      ? `${llm.model} is idle and its design guide is cached: requests start immediately`
      : `${llm.model} is pre-reading its design guide in the background (~40s once per server start)`;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-muted-foreground sm:flex" role="status" aria-live="polite">
          {active ? <Loader2 className="size-3 animate-spin text-primary" /> : <span className={cn("size-1.5 rounded-full", dot)} />}
          <Cpu className="size-3.5" />
          {llm?.model && <span className="hidden lg:inline">{llm.model} ·</span>}
          <span className={cn(active && "text-foreground")}>{text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}
