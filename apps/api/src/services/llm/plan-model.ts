/** The model that writes plans. */
export const PLAN_MODEL = "claude-opus-5-5";

/** Thinking depth. Opus 5.5 defaults to "medium"; set it explicitly so it doesn't drift. */
export const PLAN_EFFORT = "medium" as const;

/** API calls per run: the first attempt plus fixes. */
export const MAX_TURNS = 4;

/** Plenty for a 12-scene plan plus thinking, and safe for a non-streaming request. */
export const MAX_OUTPUT_TOKENS = 16_000;
