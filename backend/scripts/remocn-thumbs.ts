// Pre-renders one thumbnail per remocn component for the studio's remocn gallery:
// public/remocn-thumbs/<name>.jpg — the component on its library demo slide (real composer + player, headless Chrome).
// Usage: npm run remocn:thumbs [-- --force] [filter]     (existing thumbnails are kept unless --force)
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { REMOCN_COMPONENTS } from "../runtime/remocn/registry";
import { demoVideo } from "../runtime/demo";
import type { VideoSpec } from "../runtime/types";
import { composeHtml } from "../lib/compose";

const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const BATCH = 15;
const OUT = path.join(process.cwd(), "public", "remocn-thumbs");
const tmp = path.join(process.cwd(), "data", "test-output", "remocn-thumbs");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
const force = process.argv.includes("--force");
const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));
const name = (id: string) => id.slice("remocn.".length);
const comps = REMOCN_COMPONENTS.filter((c) => (!filter || c.id.includes(filter)) && (force || !fs.existsSync(path.join(OUT, `${name(c.id)}.jpg`))));

(async () => {
  if (!comps.length) return console.log("[remocn] thumbnails are up to date");
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  let done = 0;
  const failed: string[] = [];
  for (let b = 0; b < comps.length; b += BATCH) {
    const batch = comps.slice(b, b + BATCH);
    const spec: VideoSpec = { title: "remocn", theme: "midnight", slides: batch.map((c) => demoVideo(c.id)!.slides[0]), autoplay: false };
    const file = path.join(tmp, `batch-${b / BATCH}.html`);
    fs.writeFileSync(file, composeHtml(spec));
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 270 });
    try {
      await page.goto("file://" + file, { waitUntil: "load" });
      await page.addStyleTag({ content: ".pm-controls,.pm-bigplay{display:none!important}" });
      await page.waitForFunction(() => !!window.PromptMotion?.player, { timeout: 120000 });
      const scenes = await page.evaluate(() => window.PromptMotion!.player!.scenes.map((s) => ({ start: s.start, end: s.end })));
      for (let i = 0; i < scenes.length; i++) {
        // a frame well into the animation (scenes and text effects have settled by ~2.5s)
        const at = Math.min(scenes[i].end - 0.05, scenes[i].start + 2.6);
        await page.evaluate((tt) => window.PromptMotion!.player!.seek(tt), at);
        await new Promise((r) => setTimeout(r, 350)); // images / fonts / shaders paint
        await page.evaluate((tt) => window.PromptMotion!.player!.seek(tt), at);
        await page.screenshot({ path: path.join(OUT, `${name(batch[i].id)}.jpg`) as `${string}.jpg`, type: "jpeg", quality: 72 });
        done++;
      }
    } catch (e) {
      failed.push(...batch.map((c) => `${c.id} (${(e as Error).message.slice(0, 80)})`));
    }
    await page.close();
    process.stdout.write(`\r${Math.min(b + BATCH, comps.length)}/${comps.length} rendered`);
  }
  await browser.close();
  console.log(`\n[remocn] ${done} thumbnails written to public/remocn-thumbs${failed.length ? `; failed: ${failed.join(", ")}` : ""}`);
})();
