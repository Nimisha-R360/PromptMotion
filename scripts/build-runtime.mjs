// Bundles runtime/index.ts (+ anime.js, Motion, GSAP, Remotion primitives) into one IIFE
// that the composer inlines into every exported standalone HTML page.
// Also bundles the Onda add-on (React + Remotion + the Onda cards in runtime/onda) into runtime-dist/pm-onda.js,
// which the composer inlines only into pages whose slides use a card.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch");

const opts = {
  entryPoints: [path.join(root, "runtime/index.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  outfile: path.join(root, "runtime-dist/pm-runtime.js"),
  define: { "process.env.NODE_ENV": '"production"' },
  // Import Remotion's pure modules directly so React isn't pulled into the page.
  alias: {
    "remotion-core": path.join(root, "node_modules/remotion/dist/cjs"),
    "remotion-shapes": path.join(root, "node_modules/@remotion/shapes/dist/utils"),
  },
  plugins: [
    {
      // @remotion/noise only needs `random` from "remotion" — resolve it to the pure module.
      name: "remotion-pure",
      setup(b) {
        b.onResolve({ filter: /^remotion$/ }, () => ({ path: path.join(root, "node_modules/remotion/dist/cjs/random.js") }));
      },
    },
  ],
  legalComments: "none",
  metafile: true,
  logLevel: "warning",
};

const onda = {
  entryPoints: [path.join(root, "runtime/onda/addon.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  outfile: path.join(root, "runtime-dist/pm-onda.js"),
  define: { "process.env.NODE_ENV": '"production"' },
  // the Next tsconfig preserves JSX; this bundle needs it compiled
  jsx: "automatic",
  // Onda's schemas are written for Zod 3: use the Zod 3 build that ships inside the zod package (about 10× smaller here)
  plugins: [{ name: "zod-v3", setup: (b) => b.onResolve({ filter: /^zod$/ }, () => b.resolve("zod/v3", { kind: "import-statement", resolveDir: root })) }],
  banner: {
    js: "/*! Prompt Motion Onda add-on · Onda components (c) Rodrigo Botelho, MIT · Remotion (c) Remotion AG, Remotion License · React (c) Meta Platforms, MIT */",
  },
  legalComments: "none",
  metafile: true,
  logLevel: "warning",
};

if (watch) {
  const { context } = await import("esbuild");
  for (const o of [opts, onda]) await (await context(o)).watch();
  console.log("[runtime] watching…");
} else {
  for (const o of [opts, onda]) {
    const res = await build(o);
    const out = Object.values(res.metafile.outputs)[0];
    console.log(`[runtime] built ${path.relative(root, o.outfile)} (${(out.bytes / 1024).toFixed(0)} KB)`);
  }
}
