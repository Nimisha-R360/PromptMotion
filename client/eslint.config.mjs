// Same rules as the backend (React, hooks, TypeScript); the Next-specific ones are harmless here.
import { defineConfig, globalIgnores } from "eslint/config";
import backend from "../backend/eslint.config.mjs";

export default defineConfig([...backend, { rules: { "@next/next/no-html-link-for-pages": "off" } }, globalIgnores(["dist/**"])]);
