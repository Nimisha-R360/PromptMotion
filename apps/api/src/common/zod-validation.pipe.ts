import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/**
 * Validates a request part with a Zod schema (the same schemas the web app uses).
 * Usage: @Body(new ZodValidationPipe(MySchema)) body: z.infer<typeof MySchema>
 */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({ message: "Validation failed", issues: result.error.issues });
    }
    return result.data;
  }
}
