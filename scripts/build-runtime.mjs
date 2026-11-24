// Bundles runtime/index.ts (+ anime.js, Motion, GSAP, Remotion primitives) into one IIFE
// that the composer inlines into every exported standalone HTML page.
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

if (watch) {
  const { context } = await import("esbuild");
  const ctx = await context(opts);
  await ctx.watch();
  console.log("[runtime] watching…");
} else {
  const res = await build(opts);
  const out = Object.values(res.metafile.outputs)[0];
  console.log(`[runtime] built runtime-dist/pm-runtime.js (${(out.bytes / 1024).toFixed(0)} KB)`);
}
