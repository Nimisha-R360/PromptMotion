import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Env } from "../config/env.js";
import * as schema from "./schema.js";

/** Injection token for the Drizzle database. Use: @Inject(DRIZZLE) private readonly db: Database */
export const DRIZZLE = Symbol("DRIZZLE");
export type Database = NodePgDatabase<typeof schema>;

@Injectable()
class PoolShutdown implements OnApplicationShutdown {
  constructor(private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: Pool,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new Pool({ connectionString: config.get("DATABASE_URL", { infer: true }) }),
    },
    {
      provide: DRIZZLE,
      inject: [Pool],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
    PoolShutdown,
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}

/** Shorthand for injecting the database. */
export const InjectDatabase = () => Inject(DRIZZLE);
