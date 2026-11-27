import type { Theme } from "@backend/runtime/themes";

const FALLBACK = { bg: "#1b1b23", bg2: "#15151c", surface: "rgba(255,255,255,0.08)", text: "#f4f4f6", accent: "#9b7dff", accent2: "#5cc8c0" };

/**
 * A small sketch of a slide for the filmstrip: the shape of its layout in the video's theme colours. Cheap to draw
 * (no player per slide), and enough to tell the slides apart at a glance.
 */
export function SlideThumb({ layout, theme }: { layout?: string; theme?: Theme }) {
  const t = theme ?? FALLBACK;
  const bar = (width: string, height = 4, color = t.text, opacity = 0.75) => <span className="block shrink-0 rounded-full" style={{ width, height, background: color, opacity }} />;
  const box = (key: number, height = "45%", color = t.surface) => <span key={key} className="block flex-1 rounded-[3px]" style={{ height, background: color, border: `1px solid ${t.accent}33` }} />;

  let body: React.ReactNode;
  switch (layout) {
    case "hero":
    case "closing":
      body = (
        <span className="flex flex-col items-center gap-1.5">
          {bar("58%", 6)}
          {bar("36%", 3, t.text, 0.4)}
          {layout === "closing" && bar("22%", 5, t.accent, 0.9)}
        </span>
      );
      break;
    case "big-number":
      body = (
        <span className="flex flex-col items-center gap-1.5">
          {bar("40%", 12, t.accent, 0.95)}
          {bar("30%", 3, t.text, 0.4)}
        </span>
      );
      break;
    case "quote":
      body = (
        <span className="flex flex-col items-center gap-1.5">
          <span className="text-base leading-none font-bold" style={{ color: t.accent }}>
            &ldquo;
          </span>
          {bar("64%", 3)}
          {bar("50%", 3)}
          {bar("24%", 3, t.text, 0.4)}
        </span>
      );
      break;
    case "stats":
    case "cards":
      body = (
        <span className="flex flex-col gap-1.5">
          {bar("42%", 4)}
          <span className="flex h-7 items-end gap-1">{Array.from({ length: layout === "stats" ? 4 : 3 }, (_, i) => box(i, "100%"))}</span>
        </span>
      );
      break;
    case "chart":
      body = (
        <span className="flex flex-col gap-1.5">
          {bar("38%", 4)}
          <span className="flex h-8 items-end gap-1 px-1">
            {[45, 70, 55, 90, 65].map((h, i) => (
              <span key={i} className="block flex-1 rounded-t-[2px]" style={{ height: `${h}%`, background: i === 3 ? t.accent : t.accent2, opacity: i === 3 ? 0.95 : 0.55 }} />
            ))}
          </span>
        </span>
      );
      break;
    case "timeline":
      body = (
        <span className="flex flex-col gap-2">
          {bar("40%", 4)}
          <span className="relative flex items-center justify-between px-1">
            <span className="absolute inset-x-1 top-1/2 h-px" style={{ background: t.text, opacity: 0.3 }} />
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="relative block size-2 rounded-full" style={{ background: t.accent }} />
            ))}
          </span>
        </span>
      );
      break;
    case "split-image":
      body = (
        <span className="flex items-center gap-2">
          <span className="flex flex-1 flex-col gap-1.5">
            {bar("80%", 4)}
            {bar("90%", 2, t.text, 0.4)}
            {bar("70%", 2, t.text, 0.4)}
          </span>
          <span className="block h-10 w-[42%] rounded-[3px]" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, opacity: 0.7 }} />
        </span>
      );
      break;
    case "showcase":
      body = <span className="mx-auto block h-11 w-[70%] rounded-[4px]" style={{ background: t.surface, border: `1px solid ${t.accent}55` }} />;
      break;
    default:
      // title-bullets and anything new
      body = (
        <span className="flex flex-col gap-1.5">
          {bar("48%", 4)}
          {bar("80%", 2, t.text, 0.4)}
          {bar("72%", 2, t.text, 0.4)}
          {bar("64%", 2, t.text, 0.4)}
        </span>
      );
  }
  return (
    <span aria-hidden className="flex size-full flex-col justify-center px-3 py-2" style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.bg2})` }}>
      {body}
    </span>
  );
}
