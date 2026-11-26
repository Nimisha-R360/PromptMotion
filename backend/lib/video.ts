import "server-only";
import type { VideoSpec } from "@/runtime/types";
import type { Project } from "@/lib/types";
import { resolveAssets } from "@/lib/assets";

/**
 * Assemble the VideoSpec for preview/export.
 *  - scope "slide": slides up to `index` that have a design, focused (looping) on `index`
 *  - scope "all": every designed slide (approved + in review)
 *  - scope "approved": only approved slides (export)
 */
export function buildVideoSpec(
  project: Project,
  scope: "slide" | "all" | "approved",
  index = 0,
  format: "video" | "web" = "video",
  opts: { editable?: boolean } = {},
): VideoSpec | null {
  // a web page always shows every designed section; the selected slide is scrolled into view
  if (format === "web" && scope === "slide") scope = "all";
  const pick = project.slides.filter((s) => {
    if (!s.spec) return false;
    if (scope === "approved") return s.status === "approved";
    if (scope === "slide") return s.index <= index;
    return true;
  });
  if (!pick.length) return null;
  // voiceover plays in the video player (the web page doesn't speak yet); off → the slides play silently
  const voice = project.voiceover.on && format === "video";
  const slides = pick.map((s) => resolveAssets(voice ? s.spec! : { ...s.spec!, voice: undefined }, project.id));
  const focus = scope === "slide" || format === "web" ? pick.findIndex((s) => s.index === index) : undefined;
  return {
    format,
    title: project.title,
    theme: project.theme,
    slides,
    autoplay: true,
    loop: scope === "slide",
    focus: focus != null && focus >= 0 ? focus : undefined,
    captions: voice && project.voiceover.captions,
    // studio preview: clicking a text opens the text editor for that slide
    ...(opts.editable ? { editable: true, refs: pick.map((s) => s.index) } : {}),
  };
}
