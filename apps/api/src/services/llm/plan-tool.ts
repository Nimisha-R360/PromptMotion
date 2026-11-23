import { VideoPlanSchema } from "@promptmotion/shared";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * JSON Schema keywords that strict tool use doesn't support. They're removed from what
 * Claude sees; Zod still checks them when the plan comes back.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "pattern",
]);

/** Make Zod's JSON Schema acceptable for `strict: true`. */
const toStrictJsonSchema = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(toStrictJsonSchema);
  if (!node || typeof node !== "object") return node;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    // The scene types never overlap (they differ in `type`), so anyOf means the same as oneOf.
    result[key === "oneOf" ? "anyOf" : key] = toStrictJsonSchema(value);
  }
  return result;
};

export const SUBMIT_PLAN_TOOL_NAME = "submit_plan";

export const submitPlanTool: Anthropic.Beta.BetaTool = {
  name: SUBMIT_PLAN_TOOL_NAME,
  description:
    "Submit the finished video plan. Call this exactly once with the complete plan. If it returns errors, fix them and call it again with the full corrected plan.",
  strict: true,
  input_schema: toStrictJsonSchema(
    z.toJSONSchema(VideoPlanSchema),
  ) as Anthropic.Beta.BetaTool["input_schema"],
};
