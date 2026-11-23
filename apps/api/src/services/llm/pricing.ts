import type Anthropic from "@anthropic-ai/sdk";

/** USD per million tokens. Cache writes use the 5-minute TTL rate (1.25x input). */
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

/** Rough cost of one response from list prices. Null when the model isn't listed. */
export const estimateCostUsd = (model: string, usage: Anthropic.Beta.BetaUsage): number | null => {
  const price = PRICES[model];
  if (!price) return null;
  const perToken = (perMillion: number, tokens: number | null | undefined) =>
    (perMillion * (tokens ?? 0)) / 1_000_000;
  return (
    perToken(price.input, usage.input_tokens) +
    perToken(price.output, usage.output_tokens) +
    perToken(price.cacheRead, usage.cache_read_input_tokens) +
    perToken(price.cacheWrite, usage.cache_creation_input_tokens)
  );
};
