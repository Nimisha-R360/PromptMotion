import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Film, Loader2, MessageSquare, PanelRightClose, Paperclip, Plus, RefreshCw, SendHorizontal, TriangleAlert, CircleCheck, ListChecks, Sparkles, MessageCircleQuestion, X, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isMediaFile, mediaUrl, type LlmProvider } from "@/lib/api";
import type { Studio } from "@/hooks/use-studio";
import type { Message, Project } from "@backend/lib/types";
import { hasStartOptions, parseStartOptions, startOptionsLabel } from "@backend/lib/start-options";
import type { Framework } from "@backend/runtime/types";
import { FrameworkDot } from "./library-panel";
import { PHASE_LABEL } from "./model-status";

const QUICK_FEEDBACK = ["More energetic", "Calmer and more elegant", "Try a different layout", "Change the transition", "Bolder background", "Use a chart for the numbers"];

/** Minimal **bold** renderer for assistant messages. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const CLOUD_NAME: Record<Exclude<LlmProvider, "local">, string> = { anthropic: "Claude", openai: "ChatGPT", groq: "Groq" };

/** The chat folded away to a thin strip: one button to open it, with a dot when something waits for the user. */
export function ChatFolded({ studio, onOpen }: { studio: Studio; onOpen: () => void }) {
  const { project, busy } = studio;
  const waiting = project?.stage === "outline_review" || project?.slides.some((s) => s.status === "review");
  const label = busy ? busy.status : waiting ? "Open the chat: something is waiting for your approval" : "Open the chat";
  return (
    <aside aria-label="AI director (folded)" className="flex w-14 shrink-0 flex-col items-center gap-1 border-l bg-sidebar py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="relative size-11" aria-label={label} onClick={onOpen}>
            {busy ? <Loader2 className="size-5 animate-spin text-primary" /> : <MessageSquare className="size-5" />}
            {waiting && !busy && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full border-2 border-sidebar bg-amber-400" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
      <span className="text-[11px] text-muted-foreground">Chat</span>
    </aside>
  );
}

export function ChatPanel({ studio, llmOnline, llmProvider, onFold }: { studio: Studio; llmOnline: boolean | null; llmProvider: LlmProvider; onFold?: () => void }) {
  const { project, busy } = studio;
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** images / video clips attached to the next message (the agent animates them and writes the text from the message) */
  const [attached, setAttached] = useState<File[]>([]);

  const messages = useMemo(() => project?.messages ?? [], [project]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy?.status]);

  // latest actionable message per kind
  const lastOutlineId = useMemo(() => [...messages].reverse().find((m) => m.kind === "outline")?.id, [messages]);
  const lastReviewByIndex = useMemo(() => {
    const m = new Map<number, number>();
    messages.forEach((x) => x.kind === "slide_review" && m.set(Number(x.meta?.index), x.id));
    return m;
  }, [messages]);

  // the agent's next-step chips are only offered on the latest message
  const lastMessageId = messages.at(-1)?.id;

  const placeholder = !project
    ? "Describe the video you want…"
    : project.stage === "outline"
      ? "Describe your video…"
      : project.stage === "outline_review"
        ? project.mode === "upload"
          ? "Type “approve” to start designing…"
          : "Approve, or say what to change in the outline…"
        : project.stage === "complete"
          ? `Feedback for slide ${studio.previewIndex + 1} — or click “New video” to start another`
          : `Feedback for slide ${studio.previewIndex + 1} — or “approve”…`;

  const submit = () => {
    if ((!text.trim() && !attached.length) || busy) return;
    studio.send(text, attached);
    setText("");
    setAttached([]);
  };

  const focusWith = (value: string) => {
    setText(value);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b pr-2 pl-4">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">AI director</h2>
        {onFold && (
          <Button variant="ghost" size="icon" className="ml-auto size-8" aria-label="Fold the chat away" title="Fold the chat away" onClick={onFold}>
            <PanelRightClose />
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4" aria-live="polite">
          <AssistantBubble>
            <p>
              Hi! I&apos;m your motion director. <strong className="text-foreground">Describe a video</strong> or{" "}
              <strong className="text-foreground">upload your slides</strong> (.pptx, .pdf, .md, images). Attach your own{" "}
              <strong className="text-foreground">images or video clips</strong> with a request and I&apos;ll animate them in remocn scenes and write the slides around them. I&apos;ll design one slide at a time with Remotion, anime.js, Motion and GSAP components — you approve each slide or ask for a redesign.
            </p>
            {llmOnline === false && (
              <p className="mt-2 flex items-start gap-1.5 text-amber-700 dark:text-amber-300/90">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {llmProvider !== "local" ? (
                  <span>
                    {CLOUD_NAME[llmProvider]} isn&apos;t reachable — I&apos;ll use the rule-based designer. Check the API key in the model settings (click the model status at the top).
                  </span>
                ) : (
                  <span>
                    The local model is offline — I&apos;ll use the rule-based designer. Start it with <code className="font-mono">npm run llm</code>.
                  </span>
                )}
              </p>
            )}
          </AssistantBubble>

          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble
                key={m.id}
                text={m.content}
                options={m.meta?.options}
                media={project ? ((m.meta?.media as string[] | undefined) ?? []).map((ref) => ({ ref, url: mediaUrl(project.id, ref), kind: project.media.find((x) => x.ref === ref)?.kind, name: project.media.find((x) => x.ref === ref)?.name })) : []}
              />
            ) : (
              <AssistantMessage
                key={m.id}
                m={m}
                project={project!}
                studio={studio}
                actionable={
                  (m.kind === "outline" && m.id === lastOutlineId && project!.stage === "outline_review") ||
                  (m.kind === "slide_review" && lastReviewByIndex.get(Number(m.meta?.index)) === m.id && project!.slides[Number(m.meta?.index)]?.status === "review")
                }
                latest={m.id === lastMessageId && !busy}
                onRevise={focusWith}
              />
            ),
          )}

          {busy && (
            <AssistantBubble>
              <span className="flex flex-wrap items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                {busy.phase && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {PHASE_LABEL[busy.phase] ?? busy.phase}
                  </Badge>
                )}
                {busy.status}
                {busy.tool && (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground" title="Agent tool in use">
                    🛠 {busy.tool}
                  </code>
                )}
                <Elapsed since={busy.startedAt} />
              </span>
            </AssistantBubble>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {project?.stage === "designing" && project.slides[studio.previewIndex]?.status === "review" && !busy && (
        <div className="flex gap-1.5 overflow-x-auto border-t px-3 pt-2 [scrollbar-width:none]">
          {QUICK_FEEDBACK.map((q) => (
            <button
              key={q}
              onClick={() => studio.redesign(studio.previewIndex, q)}
              className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] whitespace-nowrap text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {attached.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t px-3 pt-2 [scrollbar-width:none]" aria-label="Attached media">
          {attached.map((f, i) => (
            <AttachmentChip key={`${f.name}-${i}`} file={f} onRemove={() => setAttached((a) => a.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      <form
        className="flex items-end gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Button type="button" variant="ghost" size="icon" aria-label="Upload slides, images or video clips" title="Upload slides (.pptx .pdf .md) or attach images / video clips" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          <Paperclip />
        </Button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept=".pptx,.pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp4,.m4v,.webm,.mov"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (!files.length) return;
            // images / clips wait in the composer for the request that goes with them; documents upload as a deck
            if (files.every(isMediaFile)) {
              setAttached((a) => [...a, ...files].slice(0, 20));
              requestAnimationFrame(() => inputRef.current?.focus());
              return;
            }
            studio.upload(files, text.trim() || undefined);
            setText("");
          }}
        />
        <Textarea
          ref={inputRef}
          id="pm-chat-input"
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={attached.length ? (project ? `What should slide ${studio.previewIndex + 1} say or show with ${attached.length > 1 ? "these" : "this"}? (or name a slide)` : "Describe the video to make with these files…") : placeholder}
          rows={1}
          className="max-h-40 min-h-10 resize-none text-sm"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={(!text.trim() && !attached.length) || !!busy}>
          {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </form>
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-muted-foreground tabular-nums">· {Math.max(0, Math.round((now - since) / 1000))}s</span>;
}

function UserBubble({ text, options, media = [] }: { text: string; options?: unknown; media?: { ref: string; url: string; kind?: string; name?: string }[] }) {
  const opts = parseStartOptions(options);
  return (
    <div className="ml-8 flex flex-col items-end gap-1 self-end">
      {media.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1">
          {media.map((m) =>
            m.kind === "video" ? (
              <span key={m.ref} title={m.name} className="flex h-14 items-center gap-1 rounded-lg border bg-card px-2 text-[11px] text-muted-foreground">
                <Clapperboard className="size-3.5" /> <span className="max-w-24 truncate">{m.name ?? "clip"}</span>
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.ref} src={m.url} alt={m.name ?? "attached image"} title={m.name} className="h-14 max-w-24 rounded-lg border object-cover" />
            ),
          )}
        </div>
      )}
      <div className="rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
        {text}
        {/* "Start faster" options picked on the start screen */}
        {hasStartOptions(opts) && <span className="mt-1 block text-[11px] opacity-80">{startOptionsLabel(opts)}</span>}
      </div>
    </div>
  );
}

function AttachmentChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const image = file.type.startsWith("image/");
  const url = useMemo(() => (image ? URL.createObjectURL(file) : null), [file, image]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return (
    <span className="relative flex h-12 shrink-0 items-center gap-1.5 rounded-lg border bg-card pr-6 pl-1 text-[11px] text-muted-foreground" title={file.name}>
      {image && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-10 rounded-md object-cover" />
      ) : (
        <Clapperboard className="ml-1 size-4" />
      )}
      <span className="max-w-24 truncate">{file.name}</span>
      <button type="button" aria-label={`Remove ${file.name}`} onClick={onRemove} className="absolute top-0.5 right-0.5 rounded p-0.5 hover:bg-accent hover:text-foreground">
        <X className="size-3" />
      </button>
    </span>
  );
}

function AssistantBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="mr-6 flex gap-2">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="size-3.5" />
      </span>
      <div className={cn("min-w-0 flex-1 rounded-2xl rounded-tl-sm border bg-card/70 px-3 py-2 text-sm text-muted-foreground", className)}>{children}</div>
    </div>
  );
}

/** The agent's reasoning (collapsed) and its one-click next steps, sent as a chat message when clicked. */
function AgentExtras({ m, studio, latest }: { m: Message; studio: Studio; latest: boolean }) {
  const reasoning = typeof m.meta?.reasoning === "string" ? m.meta.reasoning : "";
  const suggestions = Array.isArray(m.meta?.suggestions) ? (m.meta.suggestions as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (!reasoning && !(latest && suggestions.length)) return null;
  return (
    <>
      {reasoning && (
        <details className="mt-1.5 text-[11px]">
          <summary className="cursor-pointer text-muted-foreground/80 select-none hover:text-foreground">Why this</summary>
          <p className="mt-1 italic">{reasoning}</p>
        </details>
      )}
      {latest && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Suggested replies">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => studio.send(s)}
              disabled={!!studio.busy}
              className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function AssistantMessage({ m, project, studio, actionable, latest, onRevise }: { m: Message; project: Project; studio: Studio; actionable: boolean; latest: boolean; onRevise: (v: string) => void }) {
  const warn = m.meta && m.meta.usedLlm === false && project.mode === "prompt" ? (
    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300/90">
      <TriangleAlert className="mt-px size-3 shrink-0" /> Model unavailable — used the rule-based designer.
    </p>
  ) : null;

  if (m.kind === "outline") {
    const slides = (m.meta?.slides ?? []) as { layout?: string; title: string; goal?: string }[];
    return (
      <AssistantBubble>
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <ListChecks className="size-4 text-primary" /> Outline
        </p>
        <p className="mt-1">
          <Rich text={m.content} />
        </p>
        <ol className="mt-2 flex flex-col gap-1.5">
          {slides.map((s, i) => (
            <li key={i} className="flex gap-2 rounded-md border bg-background/40 px-2 py-1.5">
              <span className="text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                  {s.title}
                  {s.layout && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      {s.layout}
                    </Badge>
                  )}
                </span>
                {s.goal && <span className="block text-[11px] leading-snug">{s.goal}</span>}
              </span>
            </li>
          ))}
        </ol>
        {warn}
        {actionable && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={studio.approveOutline} disabled={!!studio.busy}>
              <Check /> Approve &amp; design slide 1
            </Button>
            {project.mode === "prompt" && (
              <Button size="sm" variant="outline" onClick={() => onRevise("Change the outline: ")} disabled={!!studio.busy}>
                <RefreshCw /> Revise outline
              </Button>
            )}
          </div>
        )}
      </AssistantBubble>
    );
  }

  if (m.kind === "slide_review") {
    const index = Number(m.meta?.index ?? 0);
    const comps = (m.meta?.components ?? []) as { slot: string; id: string; name?: string }[];
    const slide = project.slides[index];
    return (
      <AssistantBubble className={cn(actionable && "border-primary/40")}>
        <button className="flex items-center gap-1.5 font-medium text-foreground hover:underline" onClick={() => {
          studio.setPreviewIndex(index);
          studio.setScope("slide");
        }}>
          <Film className="size-4 text-primary" /> Slide {index + 1} · {String(m.meta?.layout ?? "")}
          {slide?.status === "approved" && <CircleCheck className="size-3.5 text-emerald-400" />}
        </button>
        <p className="mt-1">{m.content}</p>
        {comps.length > 0 && (
          <details className="mt-1.5 text-[11px]">
            <summary className="cursor-pointer text-muted-foreground/80 select-none hover:text-foreground">Animation details</summary>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {comps.map((c) => (
                <span key={c.slot} className="flex items-center gap-1 rounded border bg-background/40 px-1.5 py-0.5 text-[10px]">
                  <FrameworkDot fw={c.id.split(".")[0] as Framework} />
                  <span className="text-muted-foreground">{c.slot}:</span>
                  <span className="text-foreground">{c.name ?? c.id}</span>
                </span>
              ))}
            </div>
          </details>
        )}
        {warn}
        {actionable && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-foreground">How does it look? Approve to move on, or tell me what to change.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => studio.approveSlide(index)} disabled={!!studio.busy}>
                <Check /> Approve{index < project.slides.length - 1 ? " & next" : ""}
              </Button>
              <Button size="sm" variant="outline" onClick={() => studio.redesign(index, "")} disabled={!!studio.busy}>
                <RefreshCw /> Redesign
              </Button>
            </div>
          </div>
        )}
      </AssistantBubble>
    );
  }

  if (m.kind === "question") {
    return (
      <AssistantBubble className="border-sky-400/40">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <MessageCircleQuestion className="size-4 text-sky-400" /> Question
        </p>
        <p className="mt-1">{m.content}</p>
        <AgentExtras m={m} studio={studio} latest={latest} />
      </AssistantBubble>
    );
  }

  if (m.kind === "complete") {
    return (
      <AssistantBubble className="border-emerald-500/30">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <CircleCheck className="size-4 text-emerald-400" /> Video ready
        </p>
        <p className="mt-1">{m.content}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => studio.setScope("all")}>
            <Film /> Play full video
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/projects/${project.id}/export`} download>
              <Download /> Export HTML
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => studio.openProject(null)}>
            <Plus /> New video
          </Button>
        </div>
      </AssistantBubble>
    );
  }

  return (
    <AssistantBubble>
      <Rich text={m.content} />
      <AgentExtras m={m} studio={studio} latest={latest} />
    </AssistantBubble>
  );
}
