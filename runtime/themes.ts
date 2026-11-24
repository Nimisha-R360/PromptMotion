export interface Theme {
  id: string;
  name: string;
  bg: string;
  bg2: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  display: string;
  body: string;
}

const SANS = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const THEMES: Theme[] = [
  { id: "midnight", name: "Midnight", bg: "#07080f", bg2: "#141a33", surface: "rgba(255,255,255,0.06)", text: "#f5f7ff", muted: "#9aa3c7", accent: "#7c5cff", accent2: "#22d3ee", display: `'Space Grotesk', ${SANS}`, body: SANS },
  { id: "aurora", name: "Aurora", bg: "#04130f", bg2: "#0b2e27", surface: "rgba(255,255,255,0.06)", text: "#ecfff8", muted: "#8fbfb0", accent: "#34d399", accent2: "#a78bfa", display: `'Space Grotesk', ${SANS}`, body: SANS },
  { id: "sunset", name: "Sunset", bg: "#160811", bg2: "#3b1025", surface: "rgba(255,255,255,0.07)", text: "#fff3ee", muted: "#d6a9a0", accent: "#fb7185", accent2: "#fbbf24", display: `'Playfair Display', Georgia, serif`, body: SANS },
  { id: "ocean", name: "Ocean", bg: "#031126", bg2: "#0a2a55", surface: "rgba(255,255,255,0.06)", text: "#eef6ff", muted: "#93b4d8", accent: "#38bdf8", accent2: "#818cf8", display: `'Space Grotesk', ${SANS}`, body: SANS },
  { id: "ember", name: "Ember", bg: "#120a04", bg2: "#2e1607", surface: "rgba(255,255,255,0.06)", text: "#fff7ed", muted: "#d4a373", accent: "#f97316", accent2: "#facc15", display: `'Bebas Neue', 'Oswald', Impact, sans-serif`, body: SANS },
  { id: "mono", name: "Monochrome", bg: "#0a0a0a", bg2: "#1f1f1f", surface: "rgba(255,255,255,0.06)", text: "#fafafa", muted: "#a3a3a3", accent: "#fafafa", accent2: "#737373", display: `'Space Grotesk', ${SANS}`, body: SANS },
  { id: "candy", name: "Candy", bg: "#150a24", bg2: "#2c0f45", surface: "rgba(255,255,255,0.07)", text: "#fdf4ff", muted: "#c4a5d8", accent: "#f472b6", accent2: "#60a5fa", display: `'Poppins', ${SANS}`, body: SANS },
  { id: "paper", name: "Paper (light)", bg: "#f6f3ec", bg2: "#e8e1d3", surface: "rgba(0,0,0,0.05)", text: "#1c1917", muted: "#6b625a", accent: "#c2410c", accent2: "#0f766e", display: `'Playfair Display', Georgia, serif`, body: SANS },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;800&family=Poppins:wght@600;800&family=Space+Grotesk:wght@500;700&display=swap";
