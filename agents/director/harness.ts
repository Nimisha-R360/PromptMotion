import "server-only";
import {
  AfterInvocationEvent,
  AfterToolCallEvent,
  BeforeModelCallEvent,
  BeforeToolCallEvent,
  InterventionHandler,
  type LocalAgent,
  type Plugin,
} from "@strands-agents/sdk";
import { getProject } from "@backend/lib/data/projects";
import type { LlmPhase } from "@agents/llm";
import type { Project } from "@backend/lib/types";
import { ALL_COMPONENTS } from "@backend/runtime/registry";
import { SLOT_CATEGORY, type Slot } from "@backend/runtime/types";
import type { ModelTurn } from "./model";

/**
 * Strands harness for the Director agent — everything around the model that makes its tool use reliable and the
 * conversation interactive, built on the SDK's extension points:
 *
 *  - Tool gating  (`toolsFor`)         only the tools that make sense in the current stage are offered, so a small
 *                                      model chooses among a few options instead of ten.
 *  - Intervention (`DirectorGuard`)    checks every tool call before it runs: denies repeats, wrong slide numbers,
 *                                      approvals the user didn't give and actions the stage doesn't allow — the
 *                                      reason goes back to the model so it can choose again (within the turn limit).
 *                                      Feedback arguments are grounded in what the user actually said.
 *  - Plugin       (`DirectorHarness`)  hooks for live status, a record of every tool result, and a trace line.
 *  - Reply        (`composeReply`)     after the actions, one conversational message: the model's reply (or a
 *                                      template when it is unusable) + one-click suggestions for the next step.
 */

/** Everything the harness learns during one chat turn. */
export interface TurnState {
  projectId: string;
  message: string;
  /** latest conversational output of the model (reasoning, reply, suggestions) */
  thought: string;
  reply: string;
  suggestions: string[];
  /** tool calls that ran (or were denied) this turn, in order */
  calls: { name: string; input: Record<string, unknown>; ok: boolean; result?: Record<string, unknown>; error?: string }[];
  /** a tool already posted the conversational answer (answer_question / ask_user) */
  answered: boolean;
  modelCalls: number;
  startedAt: number;
}

export function newTurn(projectId: string, message: string): TurnState {
  return { projectId, message, thought: "", reply: "", suggestions: [], calls: [], answered: false, modelCalls: 0, startedAt: Date.now() };
}

/** Wire the model's conversational output into the turn (passed to LocalGrammarModel as `onTurn`). */
export const recordModelTurn = (turn: TurnState) => (t: ModelTurn) => {
  turn.thought = t.thought;
  turn.reply = t.reply;
  turn.suggestions = t.suggestions;
};

// ───────────────────────── shared intent rules ─────────────────────────

/** the message says (somewhere) that the user accepts what they see — approve_step is refused otherwise */
export const APPROVAL_INTENT = /\b(approve[sd]?|yes|yep|yeah|ok|okay|looks? (?:good|great|fine)|lgtm|perfect|great|nice|love it|ship it|go ahead|move on|next slide|proceed|continue)\b|👍|✅/i;

/**
 * A genuine information question ("why is…?", "what effect…?") — not a polite request ("can you make…?", "how about…?").
 * For these the agent is offered only answer_question, so the grammar forces a real answer (a 3B model otherwise tends
 * to echo the question back via ask_user).
 */
export const isInfoQuestion = (m: string) =>
  /\?\s*$/.test(m.trim()) && /^\s*(why|what|which|who|when|where|is|are|does|do|did|was|were|how (?!about)\w+)\b/i.test(m) && !/^\s*(can|could|would|will) you\b/i.test(m);

/**
 * The feedback a design tool acts on must come from what the user just said. A 3B model sometimes copies older text
 * from its history (e.g. the original video request) into `feedback`; keep the model's wording only when it is drawn
 * from the current message (e.g. "more energetic" out of "switch to sunset and make slide 2 more energetic").
 */
export function groundFeedback(modelFeedback: string | undefined, userMessage: string): string {
  const words = (t: string) => t.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const fb = words(modelFeedback ?? "");
  if (!fb.length) return userMessage;
  const said = new Set(words(userMessage));
  const overlap = fb.filter((w) => said.has(w)).length / fb.length;
  return overlap >= 0.6 ? (modelFeedback as string).trim() : userMessage;
}

/** Words that name where an effect goes ("headline", "transition"…) → the slide slot. */
const SLOT_WORDS: [RegExp, Slot][] = [
  [/\b(title|headline|heading)\b/i, "title"],
  [/\btransitions?\b/i, "transition"],
  [/\b(background|backdrop)\b/i, "background"],
  [/\b(list|bullets?|items)\b/i, "items"],
  [/\b(counters?|numbers?|stats?)\b/i, "number"],
  [/\b(chart|graph)\b/i, "chart"],
  [/\b(icons?|ornaments?|decor)\b/i, "decor"],
];
const GENERIC = new Set(["effect", "effects", "animation", "animate", "slide", "title", "headline", "heading", "background", "transition", "text", "make", "more", "less", "with", "from", "into", "that", "this", "use", "the", "and", "for"]);

/**
 * The user named a specific effect for a specific part of the slide ("typewriter effect for the headline", "iris
 * transition") — a word of the message is a component name in that slot's category. That is apply_component's job:
 * design_slide would let the designer pick something else.
 */
export function namedEffect(message: string): { slot: Slot; effect: string } | null {
  const msg = message.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const [re, slot] of SLOT_WORDS) {
    if (!re.test(message)) continue;
    const pool = ALL_COMPONENTS.filter((c) => c.category === SLOT_CATEGORY[slot]);
    for (const w of msg) {
      if (w.length < 4 || GENERIC.has(w)) continue;
      if (pool.some((c) => (c.name.toLowerCase().match(/[a-z0-9]+/g) ?? ([] as string[])).includes(w))) return { slot, effect: w };
    }
  }
  return null;
}

const waitingForApproval = (p: Project) => p.stage === "outline_review" || p.slides.some((s) => s.status === "review");

// ───────────────────────── tool gating ─────────────────────────

/** Tools offered this turn — fewer, relevant choices make a small model pick the right one. */
export function toolsFor<T extends { name: string }>(project: Project, message: string, all: T[]): T[] {
  if (isInfoQuestion(message)) return all.filter((t) => t.name === "answer_question");
  const designing = project.stage === "designing" || project.stage === "complete";
  const allowed = new Set<string>(["answer_question", "ask_user", "change_theme"]);
  if (!designing && project.mode === "prompt") allowed.add("plan_outline");
  if (waitingForApproval(project)) allowed.add("approve_step");
  if (project.stage === "outline_review" || designing) allowed.add("design_slide");
  if (designing && project.slides.some((s) => s.spec)) ["edit_text", "apply_component", "split_slide"].forEach((t) => allowed.add(t));
  if ((project.stage === "outline_review" || designing) && project.media.length) allowed.add("place_media");
  return all.filter((t) => allowed.has(t.name));
}

// ───────────────────────── intervention: check each call before it runs ─────────────────────────

const SLIDE_TOOLS = new Set(["design_slide", "edit_text", "apply_component", "place_media", "split_slide"]);
const NEEDS_DESIGN = new Set(["edit_text", "apply_component", "split_slide"]);
const GROUNDED = new Set(["plan_outline", "design_slide", "place_media"]);

const callKey = (name: string, input: unknown) => `${name}:${JSON.stringify(input ?? {})}`;

export class DirectorGuard extends InterventionHandler {
  readonly name = "prompt-motion:director-guard";
  // a bug in a check must not block the user's request: the actions validate again (ActionError)
  override readonly onError = "proceed" as const;

  constructor(private turn: TurnState) {
    super();
  }

  override beforeToolCall(event: BeforeToolCallEvent) {
    const name = event.toolUse.name;
    const input = (event.toolUse.input ?? {}) as Record<string, unknown>;
    const p = getProject(this.turn.projectId);
    if (!p) return { type: "proceed" as const };

    // efficiency: never run the same call twice in one turn
    if (this.turn.calls.some((c) => c.ok && callKey(c.name, c.input) === callKey(name, input)))
      return { type: "deny" as const, reason: `${name} with these arguments already ran this turn. Do not repeat it.` };

    if (SLIDE_TOOLS.has(name)) {
      const n = Number(input.slide);
      if (!p.slides.length) return { type: "deny" as const, reason: "There are no slides yet — plan the outline first (plan_outline)." };
      if (!Number.isInteger(n) || n < 1 || n > p.slides.length)
        return { type: "deny" as const, reason: `The video has ${p.slides.length} slides — use a slide number from 1 to ${p.slides.length} (slide in view: ${p.currentIndex + 1}).` };
      if (NEEDS_DESIGN.has(name) && !p.slides[n - 1].spec)
        return { type: "deny" as const, reason: `Slide ${n} has not been designed yet — use design_slide for it first.` };
    }

    if (name === "design_slide") {
      // "looks good, next slide" — moving on from the slide in review means approving it first
      const inReview = p.slides.find((s) => s.status === "review");
      if (inReview && Number(input.slide) !== inReview.index + 1 && APPROVAL_INTENT.test(this.turn.message))
        return { type: "deny" as const, reason: `The user approved slide ${inReview.index + 1} — use approve_step (it then designs the next slide).` };
      const named = namedEffect(this.turn.message);
      if (named)
        return {
          type: "deny" as const,
          reason: `The user named a specific effect — use apply_component with slot "${named.slot}" and effect "${named.effect}" (slide ${Number(input.slide) || p.currentIndex + 1}), not design_slide.`,
        };
    }

    if (name === "approve_step") {
      // a small model sometimes "approves" when the user gave feedback — only approve what the user accepted
      if (!APPROVAL_INTENT.test(this.turn.message))
        return { type: "deny" as const, reason: "The user did not approve — they asked for something. Act on their message (e.g. design_slide with their feedback)." };
      if (!waitingForApproval(p)) return { type: "deny" as const, reason: "Nothing is waiting for approval." };
    }

    // designing a slide accepts the outline: only when the user moves on to slides, never on outline feedback
    if ((name === "design_slide" || name === "place_media") && p.stage === "outline_review" && !/\b(slides?|design|start)\b/i.test(this.turn.message) && !APPROVAL_INTENT.test(this.turn.message))
      return {
        type: "deny" as const,
        reason:
          p.mode === "prompt"
            ? "The outline is still waiting for approval — this is feedback on the outline: use plan_outline with it, or ask_user if it is too vague."
            : "The outline is still waiting for approval — ask_user whether to approve it, or what to change.",
      };

    if (name === "plan_outline" && (p.stage === "designing" || p.stage === "complete"))
      return { type: "deny" as const, reason: "The outline is already approved — change slides with design_slide or edit_text." };

    if (GROUNDED.has(name)) {
      const feedback = groundFeedback(typeof input.feedback === "string" ? input.feedback : undefined, this.turn.message);
      if (feedback !== input.feedback)
        return { type: "transform" as const, apply: () => void (event.toolUse.input = { ...input, feedback }), reason: "feedback grounded in the user's message" };
    }
    return { type: "proceed" as const };
  }
}

// ───────────────────────── plugin: status, results, trace ─────────────────────────

/** Tool results come back as text or JSON blocks — read them as an object. */
function readResult(e: AfterToolCallEvent): Record<string, unknown> {
  for (const c of e.result.content ?? []) {
    const block = c as { type?: string; json?: unknown; text?: string };
    if (block.type === "jsonBlock" && block.json && typeof block.json === "object") return block.json as Record<string, unknown>;
    if (block.type === "textBlock" && block.text) {
      try {
        const v = JSON.parse(block.text);
        if (v && typeof v === "object") return v as Record<string, unknown>;
      } catch {
        return { ok: e.result.status !== "error", error: e.result.status === "error" ? block.text : undefined, text: block.text };
      }
    }
  }
  return { ok: e.result.status !== "error" };
}

export class DirectorHarness implements Plugin {
  readonly name = "prompt-motion:director-harness";

  constructor(
    private turn: TurnState,
    private status: (phase: LlmPhase, text: string) => void,
  ) {}

  initAgent(agent: LocalAgent) {
    agent.addHook(BeforeModelCallEvent, () => {
      this.turn.modelCalls++;
      this.status("thinking", this.turn.modelCalls === 1 ? "Understanding your request…" : "Choosing a better action…");
    });

    agent.addHook(AfterToolCallEvent, (e) => {
      const result = readResult(e);
      const ok = e.result.status !== "error" && !e.error && result.ok !== false;
      this.turn.calls.push({
        name: e.toolUse.name,
        input: (e.toolUse.input ?? {}) as Record<string, unknown>,
        ok,
        result,
        error: ok ? undefined : String(result.error ?? e.error?.message ?? "failed"),
      });
    });

    agent.addHook(AfterInvocationEvent, () => {
      const t = this.turn;
      const calls = t.calls.map((c) => `${c.name}${c.ok ? "" : "✗"}`).join(",") || "none";
      console.info(`[director] ${Date.now() - t.startedAt}ms model×${t.modelCalls} tools=${calls} thought="${t.thought.slice(0, 120)}"`);
    });
  }
}

// ───────────────────────── reply + suggestions ─────────────────────────

const words = (t: string) => t.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const TOOL_NAMES = /\b(plan_outline|approve_step|design_slide|edit_text|apply_component|place_media|change_theme|split_slide|answer_question|ask_user)\b/;

/** A usable model reply: a real sentence for the user, not JSON, tool names or the user's message echoed back. */
function cleanReply(reply: string, message: string): string | null {
  const r = reply.replace(/\s+/g, " ").trim();
  if (r.length < 8 || /[{}[\]]/.test(r) || TOOL_NAMES.test(r)) return null;
  const said = new Set(words(message));
  const w = words(r);
  if (w.length && w.filter((x) => said.has(x)).length / w.length > 0.85) return null;
  return r;
}

/** Suggestions are what the user might say next: short, distinct, not questions, not what they just said. */
function cleanSuggestions(list: string[], message: string): string[] {
  const seen = new Set([message.trim().toLowerCase()]);
  const out: string[] = [];
  for (const raw of list) {
    const s = raw.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
    const key = s.toLowerCase();
    if (s.length < 3 || s.length > 48 || s.endsWith("?") || /[{}[\]]/.test(s) || TOOL_NAMES.test(s) || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.slice(0, 3);
}

/** Next steps when the model's suggestions are unusable — based on where the project is now. */
function defaultSuggestions(p: Project): string[] {
  if (p.stage === "outline") return ["Plan a 5-slide video", "Make it playful and colourful"];
  if (p.stage === "outline_review") return ["Approve", "Make it shorter", "Add a closing call to action"];
  const review = p.slides.find((s) => s.status === "review");
  if (review) return ["Approve", "Make it more energetic", "Try a different layout"];
  if (p.stage === "complete") return ["Make slide 1 punchier", "Switch to the sunset theme", "Add a typewriter title on slide 1"];
  return [`Design slide ${p.currentIndex + 1}`];
}

/** Put the approve chip first whenever something is waiting for approval. */
function withApprove(p: Project, list: string[]): string[] {
  if (!waitingForApproval(p) || list.some((s) => APPROVAL_INTENT.test(s))) return list.slice(0, 3);
  return ["Approve", ...list].slice(0, 3);
}

/** Conversational fallback for each action, when the model's own reply is unusable. */
function templateReply(c: TurnState["calls"][number], p: Project): string {
  const n = Number(c.input.slide);
  const r = c.result ?? {};
  switch (c.name) {
    case "plan_outline":
      return "I've sketched the story for your video. Want a slide added, removed or reordered before we design?";
    case "approve_step":
      return p.stage === "complete" ? "That's every slide approved — your video is ready to play and export." : `Approved! Slide ${p.currentIndex + 1} is next — tell me how it feels.`;
    case "design_slide":
      return `I reworked slide ${n} following your note. How does it feel now?`;
    case "edit_text":
      return `Done — the ${String(c.input.field ?? "text")} on slide ${n} now says exactly what you asked.`;
    case "apply_component":
      return `I put that effect on slide ${n}. Want to try a different one, or keep it?`;
    case "place_media":
      return `I built slide ${n} around ${r.media ? String(r.media) : "your file"}. Should it be bigger, or paired with different text?`;
    case "change_theme":
      return "The whole video now uses the new theme. Want to compare it with another one?";
    case "split_slide":
      return `Slide ${n} was too full, so it's now two slides (${n} and ${n + 1}).`;
    default:
      return "Done. What would you like to change next?";
  }
}

/**
 * The agent's conversational message for the turn, or null when a tool already answered (answer_question /
 * ask_user). Facts are on the review cards the actions post; this adds the human side: what was done and why,
 * plus clickable next steps.
 */
export function composeReply(turn: TurnState): { content: string; meta: Record<string, unknown> } | null {
  const p = getProject(turn.projectId);
  if (!p || turn.answered) return null;
  const done = turn.calls.filter((c) => c.ok);
  const failed = turn.calls.filter((c) => !c.ok);
  const suggestions = withApprove(p, cleanSuggestions(turn.suggestions, turn.message).length ? cleanSuggestions(turn.suggestions, turn.message) : defaultSuggestions(p));
  // shown to the user under "Why this": drop the "-> tool_name" part the model writes for itself
  const reasoning =
    turn.thought
      .replace(/\s*(?:-+>|—\s*use\b).*$/, "")
      .replace(new RegExp(TOOL_NAMES.source, "g"), (t) => t.replace("_", " "))
      .trim() || undefined;

  if (!done.length) {
    if (!failed.length) return null; // the caller posts its own "not sure" question
    // every attempt was refused: tell the user why instead of failing silently
    const why = failed[failed.length - 1].error ?? "";
    return { content: `I couldn't do that yet: ${why.replace(/\s*Do not repeat it\.?/, "")}`.trim(), meta: { suggestions: defaultSuggestions(p).slice(0, 3) } };
  }
  const content = cleanReply(turn.reply, turn.message) ?? templateReply(done[done.length - 1], p);
  return { content, meta: { suggestions, ...(reasoning ? { reasoning } : {}), tools: done.map((c) => c.name) } };
}

/** Suggestions for a message a tool posts itself (answer_question / ask_user). */
export function turnSuggestions(turn: TurnState, extra: string[] = []): string[] {
  const p = getProject(turn.projectId);
  const list = cleanSuggestions([...extra, ...turn.suggestions], turn.message);
  return p ? withApprove(p, list.length ? list : defaultSuggestions(p)) : list;
}

/** For turns handled without the model (attachments, image feedback, offline fallback): the same reply + chips. */
export function directTurn(projectId: string, message: string, name: string, input: Record<string, unknown>, result: Record<string, unknown> = {}): TurnState {
  const turn = newTurn(projectId, message);
  turn.calls.push({ name, input, ok: true, result });
  return turn;
}
