// Headless-Chrome smoke test for the remocn components: each one is shown on its library demo slide (composed by the
// real composer + player), scrubbed forward and backward, and must mount without falling back or throwing.
// Usage: npx tsx scripts/test-remocn.ts [--shots] [filter]
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { REMOCN_COMPONENTS } from "../runtime/remocn/registry";
import { demoVideo } from "../runtime/demo";
import type { VideoSpec } from "../runtime/types";
import { composeHtml } from "../lib/compose";

const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const BATCH = 15;
const outDir = path.join(process.cwd(), "data", "test-output", "remocn");
fs.mkdirSync(outDir, { recursive: true });
const shots = process.argv.includes("--shots");
const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));
const comps = REMOCN_COMPONENTS.filter((c) => !filter || c.id.includes(filter));

// noise that isn't a component failure (font loading notices, Remotion's license notice, software WebGL)
const IGNORE = /network requests to load fonts|Could not load image|CORS policy|remotion\.dev\/license|acknowledgeRemotionLicense|WebGL|GPU stall|GL Driver|swiftshader|Failed to load resource|ERR_|net::/i;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const failed = new Map<string, string>();
  for (let b = 0; b < comps.length; b += BATCH) {
    const batch = comps.slice(b, b + BATCH);
    const slides = batch.map((c) => demoVideo(c.id)!.slides[0]);
    const spec: VideoSpec = { title: "remocn", theme: "midnight", slides, autoplay: false };
    const file = path.join(outDir, `batch-${b / BATCH}.html`);
    fs.writeFileSync(file, composeHtml(spec));
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });
    let current = -1;
    page.on("console", (m) => {
      const text = m.text();
      if ((m.type() === "warn" || m.type() === "error") && !IGNORE.test(text) && current >= 0 && !failed.has(batch[current].id)) failed.set(batch[current].id, text.slice(0, 200));
    });
    page.on("pageerror", (e) => current >= 0 && failed.set(batch[current].id, `pageerror: ${(e as Error).message.slice(0, 200)}`));
    await page.goto("file://" + file, { waitUntil: "load" });
    try {
      await page.waitForFunction(() => !!window.PromptMotion?.player, { timeout: 120000 });
    } catch {
      for (const c of batch) if (!failed.has(c.id)) failed.set(c.id, "page did not boot (batch timeout)");
      await page.close();
      continue;
    }
    const scenes = await page.evaluate(() => window.PromptMotion!.player!.scenes.map((s) => ({ start: s.start, end: s.end })));
    for (let i = 0; i < scenes.length; i++) {
      current = i;
      // the component's own element must exist (otherwise the slide fell back to a core effect)
      for (const dt of [0.05, 0.6, 1.5, 3]) await page.evaluate((tt) => window.PromptMotion!.player!.seek(tt), Math.min(scenes[i].end - 0.01, scenes[i].start + dt));
      const mounted = await page.evaluate((idx) => !!document.querySelectorAll(".pm-scene")[idx]?.querySelector(".pm-rc-box > *, .pm-rc-fill > *, .pm-rc-icon > *, .pm-showcase > *"), i);
      if (!mounted && !failed.has(batch[i].id)) failed.set(batch[i].id, "not mounted (fell back)");
      if (shots) await page.screenshot({ path: path.join(outDir, `${batch[i].id}.png`) as `${string}.png` });
    }
    current = -1;
    for (let t = scenes[scenes.length - 1].end; t > 0; t -= 2.3) await page.evaluate((tt) => window.PromptMotion!.player!.seek(tt), t);
    await page.close();
    process.stdout.write(`\r${Math.min(b + BATCH, comps.length)}/${comps.length} tested, ${failed.size} failing`);
  }
  await browser.close();
  console.log();
  for (const [id, why] of failed) console.log(`  ✗ ${id}: ${why}`);
  console.log(failed.size ? `❌ ${failed.size} of ${comps.length} remocn components failed` : `✅ all ${comps.length} remocn components render`);
  process.exit(failed.size ? 1 : 0);
})();
