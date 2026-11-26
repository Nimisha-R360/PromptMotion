// Builds the Magic UI add-on (runtime/magicui): runtime-dist/magicui/host.js (React, ReactDOM, motion, the scoped
// Tailwind CSS and mount()) + runtime-dist/magicui/c/<slug>.js (one per component, registering itself with the host).
// Pages only inline the host and the components their slides use (lib/compose.ts).
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import postcss from "postcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "runtime-dist/magicui");
const SCOPE = ".pm-mu";
const started = Date.now();

// ── slugs offered as cards (runtime/magicui-cards.ts) ──
const cardsSrc = fs.readFileSync(path.join(root, "runtime/magicui-cards.ts"), "utf8");
const slugs = [...new Set([...cardsSrc.matchAll(/"magicui\.card\.([a-z0-9-]+)",/g)].map((m) => m[1]))];

// ── CSS: Tailwind (theme, scoped preflight, utilities) for the classes Magic UI and the scenes use ──
const globals = fs.readFileSync(path.join(root, "runtime/magicui/theme.css"), "utf8");
/** the shadcn colour tokens (the first `@theme inline` block) and the Magic UI animations block of runtime/magicui/theme.css */
const tokens = globals.match(/@theme inline \{[\s\S]*?\n\}/)?.[0] ?? "";
const magic = globals.slice(globals.indexOf("/* Magic UI (components/magicui"));
const source = [
  `@import "tailwindcss/theme.css";`,
  `@import "tailwindcss/preflight.css";`,
  `@import "tailwindcss/utilities.css";`,
  `@import "tw-animate-css";`,
  `@custom-variant dark (&:is(.dark *));`,
  tokens,
  magic,
].join("\n");
const compiler = await compile(source, { base: path.join(root, "runtime/magicui"), onDependency() {} });
const scanner = new Scanner({
  sources: [
    { base: path.join(root, "components/magicui"), pattern: "**/*.tsx", negated: false },
    { base: path.join(root, "components/ui"), pattern: "button.tsx", negated: false },
    { base: path.join(root, "runtime/magicui"), pattern: "**/*.tsx", negated: false },
  ],
});
const raw = compiler.build(scanner.scan());

/** Scope every rule under .pm-mu (page-level selectors become the container), drop @layer wrappers. */
const scoped = postcss([
  {
    postcssPlugin: "pm-mu-scope",
    Once(css) {
      css.walkAtRules("layer", (at) => (at.nodes?.length ? at.replaceWith(at.nodes) : at.remove()));
      css.walkRules((rule) => {
        if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
        rule.selectors = rule.selectors.map((sel) => {
          const s = sel.trim();
          if (/^(:root|:host|html|body|:host\(\))$/.test(s) || s === ":root, :host") return SCOPE;
          if (/^(html|:host)\b/.test(s)) return s.replace(/^(html|:host)/, SCOPE);
          return `${SCOPE} ${s}`;
        });
      });
    },
  },
]).process(raw, { from: undefined }).css;

// ── bundles ──
const common = {
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  define: { "process.env.NODE_ENV": '"production"' },
  jsx: "automatic",
  legalComments: "none",
  logLevel: "error",
  metafile: true,
  tsconfig: path.join(root, "tsconfig.json"),
};

/** the compiled CSS, imported by the host as `magicui-css` */
const cssModule = {
  name: "pmu-css",
  setup(b) {
    b.onResolve({ filter: /^magicui-css$/ }, () => ({ path: "magicui-css", namespace: "pmu-css" }));
    b.onLoad({ filter: /.*/, namespace: "pmu-css" }, () => ({ contents: `export default ${JSON.stringify(scoped)};`, loader: "js" }));
  },
};

/** React, ReactDOM and motion come from the host (one shared instance for every component). */
const sharedFromHost = {
  name: "pmu-shared",
  setup(b) {
    b.onResolve({ filter: /^(react|react\/jsx-runtime|react-dom|react-dom\/client|motion\/react)$/ }, (a) => ({ path: a.path, namespace: "pmu-shared" }));
    b.onLoad({ filter: /.*/, namespace: "pmu-shared" }, (a) => ({ contents: `module.exports = window.__PMU__.modules[${JSON.stringify(a.path)}];`, loader: "js" }));
  },
};

/**
 * shiki (code-comparison) ships every language and theme; bundle only the core with a few languages and the two
 * GitHub themes the component uses, so the bundle stays small.
 */
const shikiSlim = {
  name: "pmu-shiki",
  setup(b) {
    b.onResolve({ filter: /^shiki$/ }, () => ({ path: "shiki-slim", namespace: "pmu-shiki" }));
    b.onLoad({ filter: /.*/, namespace: "pmu-shiki" }, () => ({
      resolveDir: root,
      loader: "js",
      contents: `
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
const langs = [import("shiki/langs/typescript.mjs"), import("shiki/langs/javascript.mjs"), import("shiki/langs/tsx.mjs"), import("shiki/langs/json.mjs"), import("shiki/langs/bash.mjs"), import("shiki/langs/python.mjs")];
let hl;
const get = () => (hl ??= createHighlighterCore({ themes: [import("shiki/themes/github-dark.mjs"), import("shiki/themes/github-light.mjs")], langs, engine: createJavaScriptRegexEngine() }));
const LANGS = ["typescript", "javascript", "tsx", "json", "bash", "python"];
export async function codeToHtml(code, opts) {
  const h = await get();
  return h.codeToHtml(code, { ...opts, lang: LANGS.includes(opts.lang) ? opts.lang : "typescript" });
}`,
    }));
  },
};

/** One virtual entry per component: import it and its scene builder, register with the host. */
const entries = {
  name: "pmu-entries",
  setup(b) {
    b.onResolve({ filter: /^magicui-entry:/ }, (a) => ({ path: a.path.slice("magicui-entry:".length), namespace: "magicui-entry" }));
    b.onLoad({ filter: /.*/, namespace: "magicui-entry" }, (a) => ({
      resolveDir: root,
      loader: "js",
      contents: `import * as M from ${JSON.stringify(`./components/magicui/${a.path}`)};\nwindow.__PMU__.register(${JSON.stringify(a.path)}, M);\n`,
    }));
  },
};

fs.rmSync(OUT, { recursive: true, force: true });
const host = await build({ ...common, entryPoints: [path.join(root, "runtime/magicui/host.tsx")], outfile: path.join(OUT, "host.js"), plugins: [cssModule] });
const comps = await build({
  ...common,
  entryPoints: slugs.map((s) => ({ in: `magicui-entry:${s}`, out: s })),
  outdir: path.join(OUT, "c"),
  plugins: [sharedFromHost, shikiSlim, entries],
});
const kb = (m) => Object.values(m.outputs).reduce((n, o) => n + o.bytes, 0) / 1024;
console.log(
  `[magicui] built host (${kb(host.metafile).toFixed(0)} KB, css ${(scoped.length / 1024).toFixed(0)} KB) + ${slugs.length} components (${(kb(comps.metafile) / 1024).toFixed(1)} MB total) in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
