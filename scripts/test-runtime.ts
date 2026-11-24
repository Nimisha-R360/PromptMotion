// Headless-Chrome smoke test: every registry component must be implemented and scrub without errors.
// Usage: npx tsx scripts/test-runtime.ts [--shots]
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { COMPONENTS } from "../runtime/registry";
import { demoVideo } from "../runtime/demo";
import type { VideoSpec } from "../runtime/types";
import { composeHtml } from "../lib/compose";

const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const outDir = path.join(process.cwd(), "data", "test-output");
fs.mkdirSync(outDir, { recursive: true });

const slides = COMPONENTS.flatMap((c) => demoVideo(c.id)!.slides);
const owners = COMPONENTS.flatMap((c) => demoVideo(c.id)!.slides.map(() => c.id));
const spec: VideoSpec = { title: "All components", theme: "midnight", slides, autoplay: false };
const file = path.join(outDir, "all-components.html");
fs.writeFileSync(file, composeHtml(spec));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  const problems: string[] = [];
  let currentScene = -1;
  page.on("console", (m) => {
    if (m.type() === "warn" || m.type() === "error") problems.push(`[scene ${currentScene} ${owners[currentScene] ?? ""}] ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`[pageerror scene ${currentScene}] ${(e as Error).message}`));
  await page.goto("file://" + file, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.PromptMotion?.player, { timeout: 20000 });

  const impl = await page.evaluate(() => window.PromptMotion!.implementedIds());
  const implSet = new Set(Object.values(impl).flat());
  const missing = COMPONENTS.filter((c) => !implSet.has(c.id)).map((c) => c.id);
  const extra = [...implSet].filter((id) => !COMPONENTS.some((c) => c.id === id));

  const scenes = await page.evaluate(() => window.PromptMotion!.player!.scenes.map((s) => ({ start: s.start, end: s.end })));
  const shots = process.argv.includes("--shots");
  for (let i = 0; i < scenes.length; i++) {
    currentScene = i;
    for (const dt of [0.05, 0.3, 0.6, 1.2, 2.5, 4]) {
      const t = Math.min(scenes[i].end - 0.01, scenes[i].start + dt);
      await page.evaluate((tt) => window.PromptMotion!.player!.seek(tt), t);
    }
    if (shots) {
      await page.evaluate((tt) => window.PromptMotion!.player!.seek(tt), scenes[i].start + (i > 0 && owners[i].includes("transition") ? 0.45 : 2.5));
      await page.screenshot({ path: path.join(outDir, `${String(i).padStart(2, "0")}-${owners[i]}.png`) as `${string}.png` });
    }
  }
  // scrub backwards across the whole video too (seek idempotency)
  for (let t = scenes[scenes.length - 1].end; t > 0; t -= 1.7) await page.evaluate((tt) => window.PromptMotion!.player!.seek(tt), t);
  await browser.close();

  console.log(`components: ${COMPONENTS.length}, implemented: ${implSet.size}, scenes: ${scenes.length}`);
  if (missing.length) console.log("MISSING implementations:", missing);
  if (extra.length) console.log("Implemented but not in registry:", extra);
  if (problems.length) console.log("PROBLEMS:\n" + [...new Set(problems)].join("\n"));
  const ok = !missing.length && !extra.length && !problems.length;
  console.log(ok ? "✅ runtime OK" : "❌ runtime has problems");
  process.exit(ok ? 0 : 1);
})();
