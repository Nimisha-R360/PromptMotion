import "server-only";
import { z } from "zod";
import { Agent, Message, SlidingWindowConversationManager, SequentialToolExecutor, tool, type MessageData, type ToolContext } from "@strands-agents/sdk";
import { DYNAMIC_MARKER, LocalGrammarModel } from "./model";
import { ActionError, applyComponent, approveOutline, approveSlide, changeTheme, designSlide, editText, planOutline, splitSlide, type Reporter } from "@/lib/actions";
import { addMessage, getAgentMemory, getProject, saveAgentMemory } from "@/lib/data/projects";
import { LlmUnavailableError, type LlmPhase } from "@/lib/llm";
import { COMPONENTS, getComponent } from "@/runtime/registry";
import { SLOT_CATEGORY, type Slot } from "@/runtime/types";
import { slotsFor } from "@/runtime/layouts";
import { THEMES } from "@/runtime/themes";
import type { Project } from "@/lib/types";

/**
 * Director agent (Strands Agents SDK + local llama.cpp model).
 *
 * - Decides the next action(s) from the user's chat message and calls tools — 1 grammar-constrained model call per turn.
 * - Human in the loop: every design-changing tool ends the turn and leaves the slide "in review" for the user to
 *   approve or redesign; the agent never approves on its own.
 * - Memory: a small sliding window of recent messages (persisted per project) + a compact, always-fresh project state
 *   block in the system prompt, instead of replaying long history — keeps prompts short for the 3B model.
 */

export interface AgentEvents {
  status: (phase: LlmPhase, text: string) => void;
  tool: (name: string, args: unknown) => void;
}

const MEMORY_WINDOW = 10; // messages kept between turns (≈ 4-5 exchanges incl. tool results)
const MAX_MODEL_CALLS = 3; // per user message: first choice + up to 2 corrections after tool errors

/**
 * A genuine information question ("why is…?", "what effect…?") — not a polite request ("can you make…?", "how about…?").
 * For these the agent is offered only answer_question, so the grammar forces a real answer (a 3B model otherwise tends
 * to echo the question back via ask_user).
 */
export const isInfoQuestion = (m: string) =>
  /\?\s*$/.test(m.trim()) && /^\s*(why|what|which|who|when|where|is|are|does|do|did|was|were|how (?!about)\w+)\b/i.test(m) && !/^\s*(can|could|would|will) you\b/i.test(m);

const AFFIRMATIVE = /^(y|yes|yep|ok|okay|approve|approved|looks good|look good|lgtm|great|perfect|next|good|nice|love it|ship it|👍|✅)\b[\s!.]*$/i;

const STATIC_PROMPT = `You are the Director agent of Prompt Motion. You plan, design and animate short videos made of slides (also exportable as an animated web page). You act ONLY by calling tools.
Human in the loop: every design change is shown to the user, who approves it or asks for changes. Never approve unless the user clearly approves.
Choose the tool:
- new video request, or feedback on the outline before it is approved -> plan_outline
- user approves ("looks good", "yes", "next", "approve") -> approve_step
- feedback about how a slide looks (mood, layout, colours, energy, style) -> design_slide with that feedback
- exact wording change ("change the title to ...", "add text ...", "remove the subtitle") -> edit_text
- a specific animation, effect, background or transition -> apply_component
- colour theme of the whole video -> change_theme
- too much content on one slide -> split_slide
- any question ("why…", "what…", "which…", "how…", "can you…?") about the project, slides or the app -> answer_question, using PROJECT STATE to answer
- only when an instruction is too vague to act on -> ask_user with one short question (never repeat the user's question back)
Slides are numbered from 1. If the user gives no slide number, use the slide in view.
App facts: 80 animation components (Remotion, anime.js, Motion, GSAP), 10 layouts, 6 visual styles, 8 themes; export as a video HTML file or an animated web page; desktop/tablet/mobile previews.`;

/** Compact, always-current project state (cheap context instead of long history). */
export function stateBlock(p: Project, inView: number): string {
  const stage = { outline: "no outline yet", outline_review: "outline waiting for the user's approval", designing: "designing slides", complete: "all slides approved" }[p.stage];
  const lines = p.slides.slice(0, 14).map((s) => {
    const title = (s.spec?.title ?? s.brief.title).slice(0, 44);
    return ` ${s.index + 1}. [${s.status}] ${s.spec?.layout ?? s.brief.layout ?? "slide"}${s.spec?.style ? "/" + s.spec.style : ""} "${title}"${s.index === inView ? "  <= in view" : ""}`;
  });
  const waiting =
    p.stage === "outline_review"
      ? "approval of the outline"
      : p.slides.find((s) => s.status === "review")
        ? `approval of slide ${p.slides.find((s) => s.status === "review")!.index + 1}`
        : "nothing";
  const cur = p.slides[inView]?.spec;
  const detail = cur
    ? `slide ${inView + 1} details: layout ${cur.layout}, style ${cur.style ?? "auto"}, ${cur.duration}s; ` +
      slotsFor(cur.layout)
        .map((s) => `${s}: ${getComponent(cur.animations[s])?.name ?? cur.animations[s]} (${cur.animations[s].split(".")[0]})`)
        .join(", ") +
      (cur.note ? `; designer note: ${cur.note}` : "")
    : "";
  return [
    `PROJECT STATE`,
    `title: ${p.title} | source: ${p.mode === "upload" ? "uploaded slides" : "prompt"} | theme: ${p.theme} | mood: ${p.mood}`,
    `stage: ${stage} | waiting for: ${waiting} | slide in view: ${inView + 1}`,
    p.slides.length ? `slides:\n${lines.join("\n")}` : "slides: none yet",
    detail,
  ]
    .filter(Boolean)
    .join("\n");
}

const slideNo = z.number().int().describe("slide number, starting at 1");

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

function buildTools(projectId: string, ev: AgentEvents, r: Reporter, userMessage = "") {
  const fresh = () => getProject(projectId)!;
  const idx = (n: number) => Math.max(0, Math.round(n) - 1);
  /** design tools hand control back to the user (human-in-the-loop) */
  const handBack = (ctx: ToolContext | undefined, what: string) => {
    ev.status("waiting", `Waiting for your feedback on ${what}`);
    ctx?.agent.cancel({ afterCurrentTools: true });
  };
  /** run an action; validation problems go back to the model so it can pick a better action */
  const guard = async <T>(name: string, input: unknown, fn: () => Promise<T> | T) => {
    ev.tool(name, input);
    try {
      return { ok: true, ...(await fn()) };
    } catch (e) {
      if (e instanceof ActionError) return { ok: false, error: e.message };
      throw e;
    }
  };

  const continueAfterApproval = async () => {
    const p = fresh();
    const next = p.slides.find((s) => s.status !== "approved");
    if (next && !next.spec) return designSlide(projectId, next.index, undefined, r);
    return { done: !next };
  };

  return [
    tool({
      name: "plan_outline",
      description: "Create the video outline from the user's request, or revise it with feedback (only before the outline is approved).",
      inputSchema: z.object({ feedback: z.string().optional() }),
      callback: async (i, ctx) => {
        const res = await guard("plan_outline", i, () => planOutline(projectId, groundFeedback(i.feedback, userMessage) || undefined, r));
        if (res.ok) handBack(ctx, "the outline");
        return res;
      },
    }),
    tool({
      name: "approve_step",
      description: "The user approves what is waiting for approval (the outline or the slide in review); then the next slide is designed.",
      inputSchema: z.object({}),
      callback: async (i, ctx) => {
        const res = await guard("approve_step", i, async () => {
          const p = fresh();
          if (p.stage === "outline_review") {
            approveOutline(projectId);
            addMessage(projectId, "user", "text", "Outline approved ✓");
            return { approved: "outline", ...(await designSlide(projectId, 0, undefined, r)) };
          }
          const inReview = p.slides.find((s) => s.status === "review");
          if (!inReview) throw new ActionError("Nothing is waiting for approval.");
          addMessage(projectId, "user", "text", `Slide ${inReview.index + 1} approved ✓`, { index: inReview.index });
          approveSlide(projectId, inReview.index);
          return { approved: `slide ${inReview.index + 1}`, ...(await continueAfterApproval()) };
        });
        if (res.ok) handBack(ctx, "the next step");
        return res;
      },
    }),
    tool({
      name: "design_slide",
      description: "Design a slide, or redesign it following the user's feedback about its look (layout, style, mood, motion).",
      inputSchema: z.object({ slide: slideNo, feedback: z.string() }),
      callback: async (i, ctx) => {
        const res = await guard("design_slide", i, async () => {
          if (fresh().stage === "outline_review") approveOutline(projectId); // designing implies the outline is accepted
          return designSlide(projectId, idx(i.slide), groundFeedback(i.feedback, userMessage) || undefined, r);
        });
        if (res.ok) handBack(ctx, `slide ${i.slide}`);
        return res;
      },
    }),
    tool({
      name: "edit_text",
      description: "Change the exact words on a slide: replace or add to its title, subtitle, body text or bullet points.",
      inputSchema: z.object({
        slide: slideNo,
        field: z.enum(["title", "subtitle", "body", "bullets"]),
        text: z.string(),
        mode: z.enum(["replace", "add"]),
      }),
      callback: async (i, ctx) => {
        const res = await guard("edit_text", i, () => editText(projectId, idx(i.slide), i.field, i.text, i.mode, r));
        if (res.ok) handBack(ctx, `slide ${i.slide}`);
        return res;
      },
    }),
    tool({
      name: "apply_component",
      description:
        "Put a specific animation effect on a slide. slot: title (headline effect), body (entrance of text/image blocks), items (list stagger), number (counters), chart, background, decor (ornaments) or transition. effect: the user's words for it, e.g. 'scramble', 'typewriter', 'particles', 'iris'.",
      inputSchema: z.object({
        slide: slideNo,
        slot: z.enum(Object.keys(SLOT_CATEGORY) as [Slot, ...Slot[]]),
        effect: z.string(),
      }),
      callback: async (i, ctx) => {
        const res = await guard("apply_component", i, () => applyComponent(projectId, idx(i.slide), resolveComponent(i.slot, i.effect), r));
        if (res.ok) handBack(ctx, `slide ${i.slide}`);
        return res;
      },
    }),
    tool({
      name: "change_theme",
      description: "Change the colour theme of the whole video.",
      inputSchema: z.object({ theme: z.enum(THEMES.map((t) => t.id) as [string, ...string[]]) }),
      callback: async (i, ctx) => {
        const res = await guard("change_theme", i, () => changeTheme(projectId, i.theme, r));
        if (res.ok) handBack(ctx, "the new theme");
        return res;
      },
    }),
    tool({
      name: "split_slide",
      description: "Split a slide with too much content into two slides.",
      inputSchema: z.object({ slide: slideNo }),
      callback: async (i, ctx) => {
        const res = await guard("split_slide", i, () => splitSlide(projectId, idx(i.slide), r));
        if (res.ok) handBack(ctx, `slides ${i.slide}–${i.slide + 1}`);
        return res;
      },
    }),
    tool({
      name: "answer_question",
      description: "Answer the user's question about the project, its slides or the app in one or two sentences.",
      inputSchema: z.object({ answer: z.string() }),
      callback: (i, ctx) => {
        ev.tool("answer_question", {});
        r.status("answering", "Answering your question…");
        addMessage(projectId, "assistant", "text", i.answer.trim() || "I'm not sure — could you rephrase?");
        ctx?.agent.cancel({ afterCurrentTools: true });
        return { ok: true };
      },
    }),
    tool({
      name: "ask_user",
      description: "Ask the user one short clarifying question when the request is unclear.",
      inputSchema: z.object({ question: z.string() }),
      callback: (i, ctx) => {
        ev.tool("ask_user", {});
        addMessage(projectId, "assistant", "question", i.question.trim() || "Could you tell me a bit more about what you'd like to change?");
        handBack(ctx, "your answer");
        return { ok: true };
      },
    }),
  ];
}

/**
 * Map the user's words for an effect ("scramble", "typing", "particles") to a registry component of the slot's
 * category — keyword scoring over id, name, description and primitives. A small model can't pick among 80 ids
 * reliably, but it can copy the user's words.
 */
export function resolveComponent(slot: Slot, effect: string): string {
  const pool = COMPONENTS.filter((c) => c.category === SLOT_CATEGORY[slot]);
  const words = effect.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !["the", "and", "effect", "animation", "use", "with"].includes(w));
  const engine = /remotion/.test(effect.toLowerCase()) ? "remotion" : /anime/.test(effect.toLowerCase()) ? "anime" : /gsap|greensock/.test(effect.toLowerCase()) ? "gsap" : /motion|framer/.test(effect.toLowerCase()) ? "motion" : null;
  let best: { id: string; score: number } | null = null;
  for (const c of pool) {
    const hay = `${c.id} ${c.name} ${c.description} ${c.uses.join(" ")} ${c.mood.join(" ")}`.toLowerCase();
    let score = words.reduce((n, w) => n + (c.name.toLowerCase().includes(w) || c.id.includes(w) ? 3 : hay.includes(w) || hay.includes(w.replace(/(ing|s)$/, "")) ? 1 : 0), 0);
    if (engine && c.framework === engine) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  if (!best) throw new ActionError(`No ${slot} effect matches "${effect}". Options: ${pool.map((c) => c.name).join(", ")}.`);
  return best.id;
}

/** Keep the memory window self-contained: it must start with a plain user message (no orphan tool results). */
function trimMemory(messages: MessageData[]): MessageData[] {
  let out = messages.slice(-MEMORY_WINDOW);
  while (out.length && (out[0].role !== "user" || out[0].content.some((c) => "toolResult" in c))) out = out.slice(1);
  return out;
}

/** The SDK may wrap model errors — look through the cause chain for "model unreachable". */
function isUnavailable(e: unknown): boolean {
  for (let cur = e as { cause?: unknown } | undefined, i = 0; cur && i < 5; cur = cur.cause as typeof cur, i++) {
    if (cur instanceof LlmUnavailableError) return true;
  }
  return false;
}

/** Rule-based routing used only when the local model is unreachable. */
async function fallbackTurn(project: Project, message: string, inView: number, r: Reporter) {
  const affirmative = AFFIRMATIVE.test(message.trim());
  if (project.stage === "outline" || project.stage === "outline_review") {
    if (affirmative && project.stage === "outline_review") {
      approveOutline(project.id);
      return designSlide(project.id, 0, undefined, r);
    }
    if (project.mode === "prompt") return planOutline(project.id, project.stage === "outline" ? undefined : message, r);
    approveOutline(project.id);
    return designSlide(project.id, 0, undefined, r);
  }
  const slide = project.slides[inView];
  if (affirmative && slide?.status === "review") {
    const res = approveSlide(project.id, inView);
    if (res.next != null && res.needsDesign) return designSlide(project.id, res.next, undefined, r);
    return res;
  }
  return designSlide(project.id, inView, message, r);
}

/** One chat turn of the Director agent. Returns how the turn was handled. */
export async function runAgentTurn(projectId: string, message: string, inView: number, ev: AgentEvents): Promise<{ via: "agent" | "fallback"; tools: string[] }> {
  const project = getProject(projectId);
  if (!project) throw new ActionError("Project not found");
  const view = Math.min(Math.max(0, inView), Math.max(0, project.slides.length - 1));
  const r: Reporter = { status: ev.status };
  const used: string[] = [];
  const events: AgentEvents = { status: ev.status, tool: (name, args) => (used.push(name), ev.tool(name, args)) };

  const memory = getAgentMemory(projectId) as MessageData[];
  let modelCalls = 0;
  const allTools = buildTools(projectId, events, r, message);
  // tool gating: information questions can only be answered (see isInfoQuestion)
  const tools = isInfoQuestion(message) ? allTools.filter((t) => t.name === "answer_question") : allTools;
  const agent = new Agent({
    model: new LocalGrammarModel(),
    tools,
    // kept short and separate from the design guide: a 3B model picks tools much more accurately with a focused prompt
    systemPrompt: `${STATIC_PROMPT}${DYNAMIC_MARKER}${stateBlock(project, view)}`,
    messages: memory.map((m) => Message.fromJSON(m)),
    conversationManager: new SlidingWindowConversationManager({ windowSize: MEMORY_WINDOW, shouldTruncateResults: true }),
    toolExecutor: new SequentialToolExecutor(), // order matters: e.g. change_theme before design_slide
    printer: false,
  });

  try {
    for await (const e of agent.stream(message)) {
      if (e.type === "beforeModelCallEvent") {
        modelCalls++;
        if (modelCalls > MAX_MODEL_CALLS) {
          agent.cancel();
          break;
        }
        ev.status("thinking", modelCalls === 1 ? "Understanding your request…" : "Choosing a different action…");
      }
    }
  } catch (e) {
    if (isUnavailable(e)) {
      ev.status("thinking", "Local model offline — using the rule-based director…");
      await fallbackTurn(project, message, view, r);
      return { via: "fallback", tools: ["fallback"] };
    }
    throw e;
  } finally {
    saveAgentMemory(projectId, trimMemory(agent.messages.map((m) => m.toJSON())));
  }

  if (!used.length) {
    // the model produced no usable action: ask instead of guessing
    addMessage(projectId, "assistant", "question", "I'm not sure what to change — could you say which slide and what you'd like (e.g. “make slide 2 calmer”)?");
  }
  return { via: "agent", tools: used };
}
