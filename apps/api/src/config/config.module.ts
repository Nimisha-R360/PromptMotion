import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { envFilePaths, validateEnv } from "./env.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFilePaths,
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
