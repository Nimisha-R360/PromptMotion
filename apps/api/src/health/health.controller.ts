import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { type Database, InjectDatabase } from "../database/database.module.js";

@Controller("health")
export class HealthController {
  constructor(@InjectDatabase() private readonly db: Database) {}

  /** `{ ok: true }` when the API and the database are both up. */
  @Get()
  async check() {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException({ ok: false });
    }
    return { ok: true };
  }
}
