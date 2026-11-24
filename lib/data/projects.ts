import "server-only";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { listMedia } from "@/lib/assets";
import type { SlideSpec } from "@/runtime/types";
import type { Message, Mood, Project, ProjectMode, ProjectStage, ProjectSummary, Slide, SlideBrief, SlideStatus } from "@/lib/types";

interface ProjectRow {
  id: string;
  title: string;
  mode: ProjectMode;
  prompt: string;
  theme: string;
  mood: Mood;
  stage: ProjectStage;
  current_index: number;
  source_name: string | null;
  created_at: string;
  updated_at: string;
}
interface SlideRow {
  id: number;
  idx: number;
  status: SlideStatus;
  brief_json: string;
  spec_json: string | null;
  revision: number;
  history_json: string;
  updated_at: string;
}
interface MessageRow {
  id: number;
  role: Message["role"];
  kind: Message["kind"];
  content: string;
  meta_json: string | null;
  created_at: string;
}

const now = () => new Date().toISOString();

const stmt = {
  insertProject: db.prepare(
    `INSERT INTO projects (id, title, mode, prompt, theme, mood, stage, source_name) VALUES (@id, @title, @mode, @prompt, @theme, @mood, @stage, @source_name)`,
  ),
  getProject: db.prepare(`SELECT * FROM projects WHERE id = ?`),
  listProjects: db.prepare(`
    SELECT p.id, p.title, p.mode, p.stage, p.theme, p.updated_at,
           COUNT(s.id) AS slide_count,
           COALESCE(SUM(s.status = 'approved'), 0) AS approved_count
    FROM projects p LEFT JOIN slides s ON s.project_id = p.id
    GROUP BY p.id ORDER BY p.updated_at DESC LIMIT ?`),
  deleteProject: db.prepare(`DELETE FROM projects WHERE id = ?`),
  touch: db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`),
  slides: db.prepare(`SELECT * FROM slides WHERE project_id = ? ORDER BY idx`),
  slide: db.prepare(`SELECT * FROM slides WHERE project_id = ? AND idx = ?`),
  deleteSlides: db.prepare(`DELETE FROM slides WHERE project_id = ?`),
  insertSlide: db.prepare(`INSERT INTO slides (project_id, idx, brief_json) VALUES (?, ?, ?)`),
  messages: db.prepare(`SELECT * FROM messages WHERE project_id = ? ORDER BY id`),
  insertMessage: db.prepare(`INSERT INTO messages (project_id, role, kind, content, meta_json) VALUES (?, ?, ?, ?, ?)`),
};

function mapSlide(r: SlideRow): Slide {
  return {
    id: r.id,
    index: r.idx,
    status: r.status,
    brief: JSON.parse(r.brief_json),
    spec: r.spec_json ? JSON.parse(r.spec_json) : null,
    revision: r.revision,
    updatedAt: r.updated_at,
  };
}
function mapMessage(r: MessageRow): Message {
  return { id: r.id, role: r.role, kind: r.kind, content: r.content, meta: r.meta_json ? JSON.parse(r.meta_json) : null, createdAt: r.created_at };
}

export function createProject(input: { title: string; mode: ProjectMode; prompt?: string; theme?: string; mood?: Mood; stage?: ProjectStage; sourceName?: string }): string {
  const id = nanoid(12);
  stmt.insertProject.run({
    id,
    title: input.title.slice(0, 120),
    mode: input.mode,
    prompt: input.prompt ?? "",
    theme: input.theme ?? "midnight",
    mood: input.mood ?? "energetic",
    stage: input.stage ?? "outline",
    source_name: input.sourceName ?? null,
  });
  return id;
}

export function getProject(id: string): Project | null {
  const p = stmt.getProject.get(id) as ProjectRow | undefined;
  if (!p) return null;
  return {
    id: p.id,
    title: p.title,
    mode: p.mode,
    prompt: p.prompt,
    theme: p.theme,
    mood: p.mood,
    stage: p.stage,
    currentIndex: p.current_index,
    sourceName: p.source_name,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    slides: (stmt.slides.all(id) as SlideRow[]).map(mapSlide),
    messages: (stmt.messages.all(id) as MessageRow[]).map(mapMessage),
    media: listMedia(id),
  };
}

export function listProjects(limit = 50): ProjectSummary[] {
  return (stmt.listProjects.all(limit) as (ProjectRow & { slide_count: number; approved_count: number })[]).map((r) => ({
    id: r.id,
    title: r.title,
    mode: r.mode,
    stage: r.stage,
    theme: r.theme,
    slideCount: r.slide_count,
    approvedCount: r.approved_count,
    updatedAt: r.updated_at,
  }));
}

export function deleteProject(id: string): boolean {
  return stmt.deleteProject.run(id).changes > 0;
}

const PROJECT_COLS = { title: "title", theme: "theme", mood: "mood", stage: "stage", currentIndex: "current_index", prompt: "prompt" } as const;
export function updateProject(id: string, patch: Partial<Pick<Project, keyof typeof PROJECT_COLS>>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, col] of Object.entries(PROJECT_COLS)) {
    const v = patch[k as keyof typeof patch];
    if (v !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(v);
    }
  }
  if (!sets.length) return;
  sets.push("updated_at = ?");
  vals.push(now(), id);
  db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

/** Replace all slide briefs (outline accepted/revised or upload parsed). */
export function replaceSlides(projectId: string, briefs: SlideBrief[]) {
  db.transaction(() => {
    stmt.deleteSlides.run(projectId);
    briefs.forEach((b, i) => stmt.insertSlide.run(projectId, i, JSON.stringify(b)));
    stmt.touch.run(now(), projectId);
  })();
}

/** Insert a new (already designed, in-review) slide right after `afterIndex`, shifting later slides down. */
export function insertSlideAfter(projectId: string, afterIndex: number, brief: SlideBrief, spec: SlideSpec) {
  db.transaction(() => {
    // two-step shift keeps UNIQUE(project_id, idx) satisfied
    db.prepare(`UPDATE slides SET idx = -(idx + 1) WHERE project_id = ? AND idx > ?`).run(projectId, afterIndex);
    db.prepare(`UPDATE slides SET idx = -idx WHERE project_id = ? AND idx < 0`).run(projectId);
    db.prepare(`INSERT INTO slides (project_id, idx, brief_json, spec_json, status, revision) VALUES (?, ?, ?, ?, 'review', 1)`).run(
      projectId,
      afterIndex + 1,
      JSON.stringify(brief),
      JSON.stringify(spec),
    );
    stmt.touch.run(now(), projectId);
  })();
}

// ─────────────── agent memory ───────────────

/** Serialized Strands messages (already windowed) for the project's Director agent. */
export function getAgentMemory(projectId: string): unknown[] {
  const row = db.prepare(`SELECT messages_json FROM agent_memory WHERE project_id = ?`).get(projectId) as { messages_json: string } | undefined;
  return row ? JSON.parse(row.messages_json) : [];
}
export function saveAgentMemory(projectId: string, messages: unknown[]) {
  db.prepare(
    `INSERT INTO agent_memory (project_id, messages_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET messages_json = excluded.messages_json, updated_at = excluded.updated_at`,
  ).run(projectId, JSON.stringify(messages), now());
}

/** Persist content edits the user asked for (e.g. "add text … to the slide") so later redesigns keep them. */
export function updateSlideBrief(projectId: string, index: number, brief: SlideBrief) {
  db.prepare(`UPDATE slides SET brief_json = ?, updated_at = ? WHERE project_id = ? AND idx = ?`).run(JSON.stringify(brief), now(), projectId, index);
}

export function getSlide(projectId: string, index: number): Slide | null {
  const r = stmt.slide.get(projectId, index) as SlideRow | undefined;
  return r ? mapSlide(r) : null;
}

/** Store a new design for a slide (keeps the previous one in history with the feedback that replaced it). */
export function saveSlideSpec(projectId: string, index: number, spec: SlideSpec, feedback?: string) {
  const r = stmt.slide.get(projectId, index) as SlideRow | undefined;
  if (!r) throw new Error("slide not found");
  const history = JSON.parse(r.history_json) as unknown[];
  if (r.spec_json) history.push({ spec: JSON.parse(r.spec_json), feedback: feedback ?? null, at: now() });
  db.prepare(
    `UPDATE slides SET spec_json = ?, status = 'review', revision = revision + 1, history_json = ?, updated_at = ? WHERE project_id = ? AND idx = ?`,
  ).run(JSON.stringify(spec), JSON.stringify(history.slice(-10)), now(), projectId, index);
  stmt.touch.run(now(), projectId);
}

/** Direct edit (e.g. applying a library component) — does not create a new revision. */
export function patchSlideSpec(projectId: string, index: number, spec: SlideSpec) {
  db.prepare(`UPDATE slides SET spec_json = ?, updated_at = ? WHERE project_id = ? AND idx = ?`).run(JSON.stringify(spec), now(), projectId, index);
  stmt.touch.run(now(), projectId);
}

export function setSlideStatus(projectId: string, index: number, status: SlideStatus) {
  db.prepare(`UPDATE slides SET status = ?, updated_at = ? WHERE project_id = ? AND idx = ?`).run(status, now(), projectId, index);
  stmt.touch.run(now(), projectId);
}

export function addMessage(projectId: string, role: Message["role"], kind: Message["kind"], content: string, meta?: Record<string, unknown>) {
  stmt.insertMessage.run(projectId, role, kind, content, meta ? JSON.stringify(meta) : null);
  stmt.touch.run(now(), projectId);
}
