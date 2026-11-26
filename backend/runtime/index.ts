import type { VideoSpec } from "./types";
import { Player } from "./player";
import { WebPage } from "./webpage";
import { RUNTIME_CSS } from "./styles";
import { implementedIds } from "./scene";

declare global {
  interface Window {
    __PM_SPEC__?: VideoSpec;
    PromptMotion?: { player?: Player; boot: typeof boot; implementedIds: typeof implementedIds };
  }
}

/**
 * Studio preview only: outline texts on hover and, on click, tell the studio which text of which slide to edit.
 * Capture phase, so the click doesn't also reach the player.
 */
function enableTextEditing(spec: VideoSpec) {
  document.documentElement.classList.add("pm-editable");
  const style = document.createElement("style");
  style.textContent =
    ".pm-editable [data-pm-field]{cursor:text}" +
    // the centered big play button would sit on top of centered titles; the control bar still plays
    ".pm-editable .pm-bigplay{display:none}" +
    ".pm-editable [data-pm-field]:hover{outline:2px dashed var(--pm-accent);outline-offset:6px;border-radius:6px}";
  document.head.appendChild(style);
  document.addEventListener(
    "click",
    (e) => {
      const target = (e.target as Element | null)?.closest?.("[data-pm-field]") as HTMLElement | null;
      const scene = target?.closest(".pm-scene") as HTMLElement | null;
      if (!target || !scene || window.parent === window) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = Number(scene.dataset.index);
      window.parent.postMessage(
        { type: "pm:editText", slide: spec.refs?.[pos] ?? pos, field: target.dataset.pmField, i: target.dataset.pmI != null ? Number(target.dataset.pmI) : undefined },
        "*",
      );
    },
    true,
  );
}

function boot(spec: VideoSpec) {
  const style = document.createElement("style");
  style.textContent = RUNTIME_CSS;
  document.head.appendChild(style);
  if (spec.editable) enableTextEditing(spec);
  const start = () => {
    if (spec.format === "web") {
      new WebPage(spec, document.body);
      window.PromptMotion = { boot, implementedIds };
      return;
    }
    const player = new Player(spec, document.body);
    window.PromptMotion = { player, boot, implementedIds };
  };
  // wait for web fonts (max 1.5s) so text splitting measures the final glyphs
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(start);
  else start();
}

window.PromptMotion = { boot, implementedIds };
const ready = () => {
  const el = document.getElementById("pm-spec");
  const spec = window.__PM_SPEC__ ?? (el ? (JSON.parse(el.textContent || "{}") as VideoSpec) : undefined);
  if (spec) boot(spec);
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
else ready();
