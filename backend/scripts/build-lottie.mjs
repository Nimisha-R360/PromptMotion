// Builds the Lottie add-on (runtime/lottie): runtime-dist/lottie/host.js (lottie-web's SVG player + mount()) and
// runtime-dist/lottie/a/<slug>.js (one per animation, registering its JSON with the host): the LottieFiles animations
// in runtime/lottie/animations and the useAnimations icons ("ua-" slugs in runtime/lottie-cards.ts, from react-useanimations).
// Pages only inline the host and the animations their slides use (lib/compose.ts).
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "runtime/lottie/animations");
const OUT = path.join(root, "runtime-dist/lottie");
const started = Date.now();

fs.rmSync(OUT, { recursive: true, force: true });
const host = await build({
  entryPoints: [path.join(root, "runtime/lottie/host.ts")],
  outfile: path.join(OUT, "host.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: "/*! Prompt Motion Lottie add-on · lottie-web (c) Airbnb, MIT · animations from LottieFiles, Lottie Simple License (runtime/lottie/credits.json) · useAnimations icons (c) useAnimations, MIT */" },
  legalComments: "none",
  logLevel: "error",
  metafile: true,
  tsconfig: path.join(root, "tsconfig.json"),
});

fs.mkdirSync(path.join(OUT, "a"), { recursive: true });
const slugs = fs.readdirSync(SRC).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
/** useAnimations icons offered as cards: slug → react-useanimations/lib/<name> */
const cardsSrc = fs.readFileSync(path.join(root, "runtime/lottie-cards.ts"), "utf8");
const uaIcons = [...cardsSrc.matchAll(/"(ua-[a-z0-9-]+)": \{[^\n]*\bua: "([A-Za-z0-9]+)"/g)].map((m) => [m[1], m[2]]);
let bytes = 0;
const write = (slug, data) => {
  // re-serialise (strips whitespace); safe to inline in <script>
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const js = `window.__PML__&&window.__PML__.register(${JSON.stringify(slug)},${json});\n`;
  fs.writeFileSync(path.join(OUT, "a", `${slug}.js`), js);
  bytes += js.length;
};
for (const slug of slugs) write(slug, JSON.parse(fs.readFileSync(path.join(SRC, `${slug}.json`), "utf8")));
for (const [slug, name] of uaIcons) {
  const mod = await import(`react-useanimations/lib/${name}`);
  write(slug, (mod.default?.animationData ?? mod.animationData));
}
const hostKb = Object.values(host.metafile.outputs).reduce((n, o) => n + o.bytes, 0) / 1024;
console.log(`[lottie] built host (${hostKb.toFixed(0)} KB) + ${slugs.length} LottieFiles animations + ${uaIcons.length} useAnimations icons (${(bytes / 1024).toFixed(0)} KB total) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
