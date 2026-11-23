import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/node_modules/", "**/.next/", "**/dist/", "**/out/", "**/next-env.d.ts"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  {
    files: ["apps/web/**/*.{js,mjs,ts,tsx}"],
    extends: [
      reactHooks.configs.flat["recommended-latest"],
      nextPlugin.configs.recommended,
      nextPlugin.configs["core-web-vitals"],
    ],
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: "apps/web/" } },
  },
  {
    files: ["packages/video/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
    languageOptions: { globals: { ...globals.browser } },
  },
  prettierConfig,
);
