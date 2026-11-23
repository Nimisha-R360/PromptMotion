import type { Logger } from "@nestjs/common";

/**
 * Prints a labelled JSON value so you can follow the data through the pipeline
 * (prompt → API → DB → worker → Claude → DB). Off in production.
 */
export const logJson = (logger: Logger, label: string, value: unknown) => {
  if (process.env.NODE_ENV === "production") return;
  logger.log(`${label}\n${JSON.stringify(value, null, 2)}`);
};
