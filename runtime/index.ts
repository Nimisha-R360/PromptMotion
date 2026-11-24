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

function boot(spec: VideoSpec) {
  const style = document.createElement("style");
  style.textContent = RUNTIME_CSS;
  document.head.appendChild(style);
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
