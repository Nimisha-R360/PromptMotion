import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.js";

const app = await NestFactory.create(AppModule);
const config = app.get<ConfigService<Env, true>>(ConfigService);

app.enableCors({
  origin: config
    .get("WEB_ORIGIN", { infer: true })
    .split(",")
    .map((origin) => origin.trim()),
});
app.enableShutdownHooks();

await app.listen(config.get("API_PORT", { infer: true }));
