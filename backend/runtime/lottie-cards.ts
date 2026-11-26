// LottieFiles animations (runtime/lottie/animations/*.json, free under the Lottie Simple License; authors in
// runtime/lottie/credits.json) and useAnimations icons (react-useanimations, MIT; "ua-" slugs) as slide cards: which
// ids exist, how each plays and where it sits on the slide.
// Pure TypeScript (no React, no lottie-web), shared by the slide runtime, the Lottie add-on (runtime/lottie/host.ts),
// the server and the site's <LottieAnimation> component (components/lottie).

/** full: the animation fills the slide behind/over the slide's title · side: the slide's text left, the animation right */
type Mode = "full" | "side";
type Mood = "calm" | "energetic" | "playful" | "elegant" | "techy" | "bold";

export interface LottieAnimationMeta {
  name: string;
  description: string;
  mode: Mode;
  /** loops for the whole scene; false = plays once, then holds its last frame */
  loop: boolean;
  mood: Mood[];
  /** a useAnimations icon: its name in react-useanimations/lib (line icons, drawn in the slide's accent colour) */
  ua?: string;
  /** one-shots: play again every this many seconds instead of holding the last frame for the rest of the scene */
  repeat?: number;
}

/** slug → the animation (LottieFiles: the file runtime/lottie/animations/<slug>.json; useAnimations: react-useanimations/lib/<ua>) */
export const LOTTIE_ANIMATIONS = {
  "success-check": { name: "Success Check", description: "A check mark draws itself inside a circle: done, approved, completed.", mode: "side", loop: false, mood: ["calm", "elegant"] },
  "error-cross": { name: "Error Cross", description: "A cross pops in a circle: failure, mistakes, what not to do.", mode: "side", loop: false, mood: ["bold"] },
  "loading-dots": { name: "Loading Dots", description: "Three bouncing dots: waiting, processing, coming soon.", mode: "side", loop: true, mood: ["calm", "techy"] },
  "confetti": { name: "Confetti", description: "A confetti burst over the slide's title: launches, milestones, thank-you slides.", mode: "full", loop: false, mood: ["playful", "energetic"] },
  "rocket-launch": { name: "Rocket Launch", description: "A rocket lifts off: launches, growth, getting started.", mode: "side", loop: true, mood: ["energetic", "playful"] },
  "rising-chart": { name: "Rising Chart", description: "Bars and a trend line grow upward: growth, results, progress.", mode: "side", loop: false, mood: ["techy", "bold"] },
  "lightbulb-idea": { name: "Lightbulb Idea", description: "A lightbulb lights up: ideas, insights, tips.", mode: "side", loop: true, mood: ["playful", "calm"] },
  "target-goal": { name: "Target Goal", description: "An arrow hits a target: goals, focus, precision.", mode: "side", loop: false, mood: ["bold", "energetic"] },
  "secure-shield": { name: "Secure Shield", description: "A shield with a check mark: security, privacy, trust.", mode: "side", loop: true, mood: ["techy", "calm"] },
  "notification-bell": { name: "Notification Bell", description: "A ringing bell: alerts, reminders, updates.", mode: "side", loop: true, mood: ["playful"] },
  "email-send": { name: "Email Send", description: "An envelope flies off: email, messages, newsletters, contact.", mode: "side", loop: true, mood: ["calm", "playful"] },
  "cloud-upload": { name: "Cloud", description: "A floating cloud: cloud storage, sync, hosting.", mode: "side", loop: true, mood: ["calm", "techy"] },
  "gear-settings": { name: "Gear Settings", description: "Turning gears: settings, how it works, engineering, process.", mode: "side", loop: true, mood: ["techy"] },
  "heart-like": { name: "Heart Like", description: "A heart pops with a burst: likes, love, favourites, customer happiness.", mode: "side", loop: false, mood: ["playful"] },
  "trophy-award": { name: "Trophy Award", description: "A shining trophy: winners, awards, achievements.", mode: "side", loop: true, mood: ["bold", "energetic"] },
  "clock-time": { name: "Clock Time", description: "A ticking clock: time, deadlines, schedules, speed.", mode: "side", loop: true, mood: ["calm"] },
  "money-coins": { name: "Money Coins", description: "Spinning coins: money, savings, rewards, pricing.", mode: "side", loop: true, mood: ["playful", "bold"] },
  "team-people": { name: "Team People", description: "A team of people working together: teams, community, collaboration.", mode: "side", loop: true, mood: ["calm", "elegant"] },
  "search-magnify": { name: "Search Magnify", description: "A magnifying glass scanning: search, research, discovery.", mode: "side", loop: true, mood: ["techy", "calm"] },
  "globe-world": { name: "Globe World", description: "A spinning globe: worldwide, global reach, travel, international.", mode: "side", loop: true, mood: ["calm", "elegant"] },
  "arrow-down": { name: "Scroll Down Arrow", description: "A bouncing arrow pointing down: next steps, scroll, more below.", mode: "side", loop: true, mood: ["calm"] },
  "star-rating": { name: "Star Rating", description: "A hand taps five stars and they fill in gold: ratings, reviews, testimonials, five-star results.", mode: "side", loop: false, mood: ["playful", "bold"] },

  // useAnimations icons (react-useanimations, MIT): line icons in the slide's accent colour; one-shots replay every 3s
  "ua-check-circle": { name: "Check Circle", description: "A check mark draws inside a circle: done, approved, completed.", mode: "side", loop: false, repeat: 3, mood: ["calm", "elegant"], ua: "checkCircle" },
  "ua-heart": { name: "Heart", description: "A heart fills in: likes, love, favourites.", mode: "side", loop: false, repeat: 3, mood: ["playful"], ua: "heart" },
  "ua-star": { name: "Star", description: "A star fills in: ratings, favourites, highlights.", mode: "side", loop: false, repeat: 3, mood: ["playful", "bold"], ua: "star" },
  "ua-thumb-up": { name: "Thumbs Up", description: "A thumbs-up wiggles: approval, feedback, recommendations.", mode: "side", loop: false, repeat: 3, mood: ["playful"], ua: "thumbUp" },
  "ua-trending-up": { name: "Trending Up", description: "A rising trend line draws itself: growth, results, momentum.", mode: "side", loop: false, repeat: 3, mood: ["techy", "bold"], ua: "trendingUp" },
  "ua-bar-chart": { name: "Bar Chart", description: "Bars grow upward: data, analytics, reports.", mode: "side", loop: false, repeat: 3, mood: ["techy"], ua: "barChart" },
  "ua-pie-chart": { name: "Pie Chart", description: "A pie chart slice pops out: shares, budgets, breakdowns.", mode: "side", loop: false, repeat: 3, mood: ["techy"], ua: "pieChart" },
  "ua-mail": { name: "Mail", description: "An envelope opens: email, newsletters, contact.", mode: "side", loop: false, repeat: 3, mood: ["calm"], ua: "mail" },
  "ua-send": { name: "Send", description: "A paper plane flies off and comes back: sending, sharing, messages.", mode: "side", loop: false, repeat: 3, mood: ["energetic"], ua: "send" },
  "ua-message-circle": { name: "Message", description: "A chat bubble animates: messages, conversations, support.", mode: "side", loop: false, repeat: 3, mood: ["calm", "playful"], ua: "messageCircle" },
  "ua-notification": { name: "Notification Bell", description: "A bell rings and a red badge pops up: alerts, reminders, updates.", mode: "side", loop: true, mood: ["playful"], ua: "notification3" },
  "ua-settings": { name: "Settings", description: "A gear pulses and turns: settings, configuration, how it works.", mode: "side", loop: false, repeat: 3, mood: ["techy"], ua: "settings" },
  "ua-lock": { name: "Lock", description: "A padlock springs open: unlock, access, getting started.", mode: "side", loop: false, repeat: 3, mood: ["techy", "calm"], ua: "lock" },
  "ua-shield": { name: "Shield", description: "A shield pulses: protection, security, trust.", mode: "side", loop: false, repeat: 3, mood: ["techy", "calm"], ua: "shield" },
  "ua-users": { name: "Users", description: "A group of people bounces: teams, community, customers.", mode: "side", loop: false, repeat: 3, mood: ["calm"], ua: "users" },
  "ua-calendar": { name: "Calendar", description: "A calendar page flips: dates, schedules, events.", mode: "side", loop: false, repeat: 3, mood: ["calm"], ua: "calendar" },
  "ua-clock": { name: "Clock", description: "Clock hands sweep: time, deadlines, speed.", mode: "side", loop: false, repeat: 3, mood: ["calm"], ua: "clock" },
  "ua-cloud": { name: "Cloud", description: "A cloud drifts in a loop: cloud storage, sync, hosting.", mode: "side", loop: true, mood: ["calm", "techy"], ua: "cloud" },
  "ua-download": { name: "Download", description: "The download tray fills up: downloads, saving, getting the app.", mode: "side", loop: false, repeat: 3, mood: ["techy"], ua: "download" },
  "ua-upload": { name: "Upload", description: "An arrow rises out of a tray: uploads, publishing, sharing files.", mode: "side", loop: false, repeat: 3, mood: ["techy"], ua: "upload" },
  "ua-zap": { name: "Lightning", description: "A lightning bolt flashes: speed, power, instant results.", mode: "side", loop: false, repeat: 3, mood: ["energetic", "bold"], ua: "zap" },
  "ua-gift": { name: "Gift", description: "A gift box opens: offers, rewards, bonuses.", mode: "side", loop: false, repeat: 3, mood: ["playful"], ua: "gift" },
  "ua-shopping-cart": { name: "Shopping Cart", description: "A cart rolls: shopping, checkout, e-commerce.", mode: "side", loop: false, repeat: 3, mood: ["playful"], ua: "shoppingCart" },
  "ua-dollar-sign": { name: "Dollar Sign", description: "A dollar sign wobbles: pricing, revenue, savings.", mode: "side", loop: false, repeat: 3, mood: ["bold"], ua: "dollarSign" },
  "ua-award": { name: "Award", description: "A medal redraws itself: awards, achievements, quality.", mode: "side", loop: false, repeat: 3, mood: ["bold", "elegant"], ua: "award" },
  "ua-target": { name: "Target", description: "Target rings pulse: goals, focus, precision.", mode: "side", loop: false, repeat: 3, mood: ["bold"], ua: "target" },
  "ua-map-pin": { name: "Map Pin", description: "A location pin bounces: places, addresses, store finder.", mode: "side", loop: false, repeat: 3, mood: ["calm"], ua: "mapPin" },
  "ua-globe": { name: "Globe", description: "A globe spins in a loop: worldwide, global reach, international.", mode: "side", loop: true, mood: ["calm", "elegant"], ua: "globe" },
  "ua-code": { name: "Code", description: "Code brackets animate: development, APIs, engineering.", mode: "side", loop: false, repeat: 3, mood: ["techy"], ua: "code" },
  "ua-terminal": { name: "Terminal", description: "A terminal prompt blinks in a loop: command line, developers, setup.", mode: "side", loop: true, mood: ["techy"], ua: "terminal" },
  "ua-database": { name: "Database", description: "A database stack animates: data, storage, backends.", mode: "side", loop: false, repeat: 3, mood: ["techy"], ua: "database" },
  "ua-infinity": { name: "Infinity", description: "An infinity sign traces itself in a loop: unlimited, forever, continuous.", mode: "side", loop: true, mood: ["calm", "elegant"], ua: "infinity" },
  "ua-loading": { name: "Loading Spinner", description: "A circular spinner loops: loading, processing, waiting.", mode: "side", loop: true, mood: ["calm", "techy"], ua: "loading" },
} as const satisfies Record<string, LottieAnimationMeta>;

export type LottieSlug = keyof typeof LOTTIE_ANIMATIONS;
export const LOTTIE_SLUGS = Object.keys(LOTTIE_ANIMATIONS) as LottieSlug[];
export const isLottieSlug = (v: unknown): v is LottieSlug => typeof v === "string" && Object.hasOwn(LOTTIE_ANIMATIONS, v);

export const LOTTIE_CARD_IDS = LOTTIE_SLUGS.map((s) => `lottie.card.${s}` as const);
export type LottieCardId = `lottie.card.${LottieSlug}`;
export const isLottieCardId = (v: unknown): v is LottieCardId => typeof v === "string" && v.startsWith("lottie.card.") && isLottieSlug(v.slice("lottie.card.".length));
/** "lottie.card.confetti" → "confetti" (the file in runtime/lottie/animations) */
export const lottieSlug = (id: LottieCardId) => id.slice("lottie.card.".length) as LottieSlug;

export const lottieCardMode = (id: LottieCardId): Mode => LOTTIE_ANIMATIONS[lottieSlug(id)].mode;
/** Lottie data with useAnimations' black line colour, drawn in the theme colour (see LOTTIE_TINT_CSS). */
export const isTinted = (slug: LottieSlug): boolean => "ua" in LOTTIE_ANIMATIONS[slug];

/**
 * CSS that recolours a useAnimations icon (the same rules react-useanimations uses): black strokes/fills take
 * --ua-stroke / --ua-fill, white "knockout" parts take --ua-knockout. Scoped to `scope`.
 */
export const lottieTintCss = (scope: string) =>
  `${scope} path[stroke^="rgb"]:not([stroke="rgb(255,255,255)"]){stroke:var(--ua-stroke)}` +
  `${scope} path[fill="rgb(0,0,0)"]{fill:var(--ua-fill,var(--ua-stroke))}` +
  `${scope} path[fill="rgb(255,255,255)"]{fill:var(--ua-knockout,transparent)}` +
  `${scope} path[stroke="rgb(255,255,255)"]{stroke:var(--ua-knockout,transparent)}`;

/** the full-slide card shows the slide's title (click edits it); side animations are decorative */
export const lottieCardField = (id: LottieCardId): string | null => (lottieCardMode(id) === "full" ? "title" : null);

/** Minimal Lottie JSON shape the players read (frame rate, in/out points, size). */
export interface LottieData {
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  [k: string]: unknown;
}

/**
 * The animation frame to show `t` seconds after it starts, at `speed`: loops wrap around, one-shots hold their last
 * frame. Pure, so scrubbing and export land on exactly the same frame.
 */
export function lottieFrameAt(data: Pick<LottieData, "fr" | "ip" | "op">, t: number, loop: boolean, speed = 1, repeat?: number): number {
  const total = Math.max(1, data.op - data.ip);
  const local = repeat && repeat > 0 ? Math.max(0, t) % repeat : Math.max(0, t);
  const f = local * data.fr * speed;
  // goToAndStop takes frames relative to the in point
  return loop ? f % total : Math.min(f, total - 1);
}
