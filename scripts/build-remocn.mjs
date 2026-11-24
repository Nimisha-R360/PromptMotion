// Bundles the remocn components (components/remocn) for the player runtime:
//  - runtime-dist/remocn/host.js       React + Remotion + @remotion/player and the mount() API (runtime/remocn/host.tsx)
//  - runtime-dist/remocn/c/<id>.js     one small bundle per component; React/Remotion come from the host at runtime
// The composer inlines the host + only the component bundles a video actually uses.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "runtime-dist/remocn");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "runtime/remocn/manifest.json"), "utf8"));
const usable = manifest.filter((e) => e.supported);

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

/** React, ReactDOM and Remotion are provided by the host (one shared instance for every component). */
const sharedFromHost = {
  name: "pmr-shared",
  setup(b) {
    b.onResolve({ filter: /^(react|react\/jsx-runtime|react-dom|remotion)$/ }, (a) => ({ path: a.path, namespace: "pmr-shared" }));
    b.onLoad({ filter: /.*/, namespace: "pmr-shared" }, (a) => ({ contents: `module.exports = window.__PMR__.modules[${JSON.stringify(a.path)}];`, loader: "js" }));
  },
};

/**
 * `import "@fontsource/manrope/500.css"` → load the same family/weight from Google Fonts at runtime
 * (keeps bundles small; the exported page already treats Google Fonts as optional).
 */
const fontsourceToGoogle = {
  name: "pmr-fontsource",
  setup(b) {
    b.onResolve({ filter: /^@fontsource\// }, (a) => ({ path: a.path, namespace: "pmr-font" }));
    b.onLoad({ filter: /.*/, namespace: "pmr-font" }, (a) => {
      const [, pkg, file = "400.css"] = a.path.match(/^@fontsource\/([^/]+)(?:\/(.+))?$/) ?? [];
      const family = pkg.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
      const weight = (file.match(/(\d{3})/) ?? [, "400"])[1];
      const href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&display=swap`;
      return {
        loader: "js",
        contents:
          `const href = ${JSON.stringify(href)};\n` +
          `if (typeof document !== "undefined" && ![...document.querySelectorAll("link[rel=stylesheet]")].some((x) => x.href === href)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); }`,
      };
    });
  },
};

/** One virtual entry per component: import it and register it with the host. */
const entries = {
  name: "pmr-entries",
  setup(b) {
    b.onResolve({ filter: /^remocn-entry:/ }, (a) => ({ path: a.path.slice("remocn-entry:".length), namespace: "remocn-entry" }));
    b.onLoad({ filter: /.*/, namespace: "remocn-entry" }, (a) => {
      const e = usable.find((x) => x.id === a.path);
      return {
        resolveDir: root,
        loader: "js",
        contents:
          `import * as M from ${JSON.stringify("./" + e.file)};\n` +
          `window.__PMR__.register(${JSON.stringify(e.id)}, { component: M[${JSON.stringify(e.export)}], props: ${JSON.stringify(e.props)}, required: ${JSON.stringify(e.required)} });\n`,
      };
    });
  },
};

const started = Date.now();
fs.rmSync(OUT, { recursive: true, force: true });
const host = await build({ ...common, entryPoints: [path.join(root, "runtime/remocn/host.tsx")], outfile: path.join(OUT, "host.js") });
const comps = await build({
  ...common,
  entryPoints: usable.map((e) => ({ in: `remocn-entry:${e.id}`, out: e.id })),
  outdir: path.join(OUT, "c"),
  plugins: [sharedFromHost, fontsourceToGoogle, entries],
});
const kb = (m) => Object.values(m.outputs).reduce((n, o) => n + o.bytes, 0) / 1024;
console.log(
  `[remocn] built host (${kb(host.metafile).toFixed(0)} KB) + ${usable.length} components (${(kb(comps.metafile) / 1024).toFixed(1)} MB total) in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
