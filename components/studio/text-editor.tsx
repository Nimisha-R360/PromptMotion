"use client";
import { useRef, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Item, Layout, SlideSpec, Stat } from "@/runtime/types";
import type { SlideTextPatch } from "@/lib/types";

/** Which text was clicked in the preview, e.g. { field: "bullets", i: 1 } or { field: "items.heading", i: 0 }. */
export interface TextTarget {
  field?: string;
  i?: number;
}

// which text each layout actually shows (see runtime/scene.ts)
const BODY_LAYOUTS: Layout[] = ["hero", "closing", "title-bullets", "split-image", "stats", "big-number", "quote"];
const BULLET_LAYOUTS: Layout[] = ["hero", "closing", "title-bullets", "split-image"];
const ITEM_LAYOUTS: Layout[] = ["cards", "timeline"];
const STAT_LAYOUTS: Layout[] = ["stats", "big-number", "chart"];

interface Draft {
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  items: Item[];
  stats: Stat[];
}

const key = (field: string, i?: number) => `${field}:${i ?? ""}`;

/**
 * Edit the words on one slide (opened by clicking a text in the preview, or the "Edit text" button).
 * Saving replaces the text directly — no model call, no waiting. Mount it with a fresh `key` per opening.
 */
export function TextEditorDialog({
  spec,
  slideNumber,
  target,
  onSave,
  onClose,
}: {
  spec: SlideSpec;
  slideNumber: number;
  target: TextTarget;
  onSave: (text: SlideTextPatch) => Promise<boolean>;
  onClose: () => void;
}) {
  const layout = spec.layout;
  const show = {
    body: BODY_LAYOUTS.includes(layout) || !!spec.body,
    bullets: !!spec.bullets?.length || (BULLET_LAYOUTS.includes(layout) && !spec.items?.length),
    items: !!spec.items?.length || (ITEM_LAYOUTS.includes(layout) && !spec.bullets?.length),
    stats: !!spec.stats?.length || STAT_LAYOUTS.includes(layout),
  };
  const max = { bullets: layout === "hero" || layout === "closing" ? 4 : 6, items: 5, stats: layout === "big-number" ? 1 : 6 };
  const initial: Draft = {
    title: spec.title,
    subtitle: spec.subtitle ?? "",
    body: spec.body ?? "",
    bullets: [...(spec.bullets ?? [])],
    items: (spec.items ?? []).map((it) => ({ ...it })),
    // a big-number slide always shows one number, even before it has one
    stats: spec.stats?.length ? spec.stats.map((st) => ({ ...st })) : layout === "big-number" ? [{ value: "", label: spec.subtitle ?? "" }] : [],
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const inputs = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>());
  const reg = (field: string, i?: number) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (el) inputs.current.set(key(field, i), el);
    else inputs.current.delete(key(field, i));
  };

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setAt = <T,>(list: T[], i: number, v: T) => list.map((x, j) => (j === i ? v : x));

  /** Only the shown fields that changed are sent. */
  const changes = (): SlideTextPatch => {
    const out: SlideTextPatch = {};
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (draft.title !== initial.title) out.title = draft.title;
    if (draft.subtitle !== initial.subtitle) out.subtitle = draft.subtitle;
    if (show.body && draft.body !== initial.body) out.body = draft.body;
    if (show.bullets && !same(draft.bullets, initial.bullets)) out.bullets = draft.bullets;
    if (show.items && !same(draft.items, initial.items)) out.items = draft.items;
    if (show.stats && !same(draft.stats, initial.stats)) out.stats = draft.stats;
    return out;
  };

  const save = async () => {
    if (!draft.title.trim() || saving) return;
    const patch = changes();
    if (!Object.keys(patch).length) return onClose();
    setSaving(true);
    const ok = await onSave(patch);
    setSaving(false);
    if (ok) onClose();
  };

  const listLabel = layout === "timeline" ? "Steps" : "Cards";
  const itemWord = layout === "timeline" ? "step" : "card";

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          // put the cursor in the text that was clicked, with its words selected
          e.preventDefault();
          const el = (target.field && inputs.current.get(key(target.field, target.i))) || inputs.current.get(key("title"));
          el?.focus();
          el?.select();
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit text · slide {slideNumber}</DialogTitle>
          <DialogDescription>Your words replace the slide&apos;s text exactly. Saving is instant: no AI step.</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void save();
            }
          }}
        >
          <Field label={layout === "quote" && !spec.body ? "Quote" : "Title"} htmlFor="te-title">
            <Input id="te-title" ref={reg("title")} value={draft.title} onChange={(e) => update("title", e.target.value)} aria-invalid={!draft.title.trim()} />
          </Field>
          <Field label={layout === "quote" ? "Author" : "Subtitle"} htmlFor="te-subtitle" hint="optional">
            <Input id="te-subtitle" ref={reg("subtitle")} value={draft.subtitle} onChange={(e) => update("subtitle", e.target.value)} />
          </Field>
          {show.body && (
            <Field label={layout === "quote" ? "Quote" : "Body text"} htmlFor="te-body" hint="optional">
              <Textarea id="te-body" ref={reg("body")} value={draft.body} onChange={(e) => update("body", e.target.value)} rows={3} className="resize-none" />
            </Field>
          )}

          {show.bullets && (
            <ListField label={BULLET_LAYOUTS.includes(layout) ? "Bullet points" : listLabel} onAdd={draft.bullets.length < max.bullets ? () => update("bullets", [...draft.bullets, ""]) : undefined} addLabel="Add bullet">
              {draft.bullets.map((b, i) => (
                <Row key={i} onRemove={() => update("bullets", draft.bullets.filter((_, j) => j !== i))} what={`bullet ${i + 1}`}>
                  <Input ref={reg("bullets", i)} value={b} onChange={(e) => update("bullets", setAt(draft.bullets, i, e.target.value))} aria-label={`Bullet ${i + 1}`} />
                </Row>
              ))}
            </ListField>
          )}

          {show.items && (
            <ListField label={listLabel} onAdd={draft.items.length < max.items ? () => update("items", [...draft.items, { heading: "", text: "" }]) : undefined} addLabel={`Add ${itemWord}`}>
              {draft.items.map((it, i) => (
                <Row key={i} onRemove={() => update("items", draft.items.filter((_, j) => j !== i))} what={`${itemWord} ${i + 1}`}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Input ref={reg("items.heading", i)} value={it.heading} placeholder="Heading" onChange={(e) => update("items", setAt(draft.items, i, { ...it, heading: e.target.value }))} aria-label={`${itemWord} ${i + 1} heading`} />
                    <Input ref={reg("items.text", i)} value={it.text} placeholder="Text" onChange={(e) => update("items", setAt(draft.items, i, { ...it, text: e.target.value }))} aria-label={`${itemWord} ${i + 1} text`} />
                  </div>
                </Row>
              ))}
            </ListField>
          )}

          {show.stats && (
            <ListField label={layout === "chart" ? "Chart values" : "Numbers"} onAdd={draft.stats.length < max.stats ? () => update("stats", [...draft.stats, { value: "", label: "" }]) : undefined} addLabel="Add number">
              {draft.stats.map((st, i) => (
                <Row key={i} onRemove={() => update("stats", draft.stats.filter((_, j) => j !== i))} what={`number ${i + 1}`}>
                  <Input ref={reg("stats.value", i)} value={st.value} placeholder="42%" onChange={(e) => update("stats", setAt(draft.stats, i, { ...st, value: e.target.value }))} className="w-24 shrink-0" aria-label={`Number ${i + 1} value`} />
                  <Input ref={reg("stats.label", i)} value={st.label} placeholder="Label" onChange={(e) => update("stats", setAt(draft.stats, i, { ...st, label: e.target.value }))} aria-label={`Number ${i + 1} label`} />
                </Row>
              ))}
            </ListField>
          )}

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter to save</span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !draft.title.trim()}>
                {saving && <Loader2 className="animate-spin" />} Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label} {hint && <span className="font-normal text-muted-foreground">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function ListField({ label, onAdd, addLabel, children }: { label: string; onAdd?: () => void; addLabel: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-medium">{label}</legend>
      {children}
      {onAdd && (
        <Button type="button" variant="ghost" size="sm" className="w-fit text-xs" onClick={onAdd}>
          <Plus /> {addLabel}
        </Button>
      )}
    </fieldset>
  );
}

function Row({ children, onRemove, what }: { children: React.ReactNode; onRemove: () => void; what: string }) {
  return (
    <div className="flex items-start gap-1.5">
      {children}
      <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onRemove} aria-label={`Remove ${what}`}>
        <Trash2 />
      </Button>
    </div>
  );
}
