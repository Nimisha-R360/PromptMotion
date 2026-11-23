import { defineConfig } from "tsup";

// Both formats: ESM for Next.js and Remotion, CommonJS for NestJS.
export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  // Don't wipe dist/ on every rebuild in watch mode, or Next.js briefly can't find the package.
  clean: !options.watch,
}));
