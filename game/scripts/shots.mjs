// Visual QA: serves the static build, drives every scene, and saves screenshots to shots/.
//   npm run shots            → all scenes at 390×844 and 1440×900
//   npm run shots -- ride    → only scenes whose name contains "ride"
//   --check                  → fail on any page error (used by `npm test`)
// Dev routes (/dev/gallery) are only shot when built with NEXT_PUBLIC_DEV_ROUTES=1.
// Also refreshes public/poster.jpg (the pre-3D poster and no-WebGL fallback) from the menu scene.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve("out"), OUT = path.resolve("shots");
const args = process.argv.slice(2), check = args.includes("--check");
const filter = args.find(a => !a.startsWith("--"));
if (!fs.existsSync(ROOT)) { console.error("Run `npm run build` first."); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const save = (coins, fixes = {}) => ({ coins, tutorialDone: true, fixes });
const g = "window.__game";
// Each scene: initial save data, then steps that drive the real game into position.
const SCENES = {
  "menu": { save: save(240), steps: async p => p.waitForTimeout(1500) },
  "plan": { save: save(240), steps: async p => { await p.click("#home [data-go=plan]"); await p.selectOption("#selTo", "9"); await p.waitForTimeout(400); } },
  "ride": { save: save(0), steps: async p => { await p.click("#home [data-go=plan]"); await p.selectOption("#selTo", "9"); await p.click("#startRide"); await p.waitForTimeout(3500); } },
  "ride-swerve": { save: save(0), steps: async p => { await p.click("#home [data-go=plan]"); await p.click("#startRide"); await p.waitForTimeout(2500); await p.evaluate(`${g}.spawnHazard('barrier', ${g}.prog + 22, ${g}.lane, 3); ${g}.swerveCd = 0`); await p.waitForTimeout(250); } },
  "ride-dust": { save: save(0), steps: async p => { await p.click("#home [data-go=plan]"); await p.click("#startRide"); await p.waitForTimeout(1500); await p.evaluate(`${g}.objs.push({ kind: 'dust', at: ${g}.prog + 5, len: 200, x: 0, w: 0, d: 0, sec: 4, hit: false })`); await p.waitForTimeout(3000); } },
  "ride-night-rain": { save: save(0), steps: async p => { await p.click("#home [data-go=plan]"); await p.click("[data-time=night]"); await p.click("[data-weather=rain]"); await p.click("#startRide"); await p.waitForTimeout(3500); } },
  "arrival": { save: save(0), steps: async p => { await p.click("#home [data-go=plan]"); await p.selectOption("#selTo", "9"); await p.click("#startRide"); await p.waitForTimeout(1200);
    await p.evaluate(`${g}.objs.forEach(o => o.mesh && ${g}.scene.remove(o.mesh)); ${g}.objs = []; ${g}.next = 1e9; ${g}.hp = ${g}.maxHp = 999; ${g}.prog = ${g}.len - 40`); await p.waitForTimeout(4500); } },
  "upgrade": { save: save(400), steps: async p => { await p.click("#home [data-go=fix]"); await p.waitForTimeout(400); } },
  "ride-improved": { save: save(0, Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i, { potholes: true, construction: true }]))), steps: async p => { await p.click("#home [data-go=plan]"); await p.click("#startRide"); await p.waitForTimeout(3500); } },
  "garage": { save: save(400), steps: async p => { await p.click("#home [data-go=garage]"); await p.waitForTimeout(400); } },
  "fallback": { save: save(0), query: "?fallback=1", steps: async p => p.waitForTimeout(400) },
  "dev-gallery": { save: save(0), path: "dev/gallery/", steps: async p => p.waitForTimeout(600) },
};
const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let failures = 0;
for (const [name, sc] of Object.entries(SCENES)) {
  if (filter && !name.includes(filter)) continue;
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage({ viewport: size });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => m.type() === "error" && !/poster\.jpg/.test(m.text()) && errors.push(m.text()));
    await page.goto(base);
    await page.evaluate(s => localStorage.setItem("urr-save-v2", JSON.stringify(s)), sc.save);
    await page.goto(base + (sc.path ?? "") + (sc.query ?? ""));
    if (!sc.query && !sc.path) await page.waitForSelector("html[data-ready='1']");
    if (sc.path && !fs.existsSync(path.join(ROOT, sc.path))) { console.log(`- ${name}: skipped (build with NEXT_PUBLIC_DEV_ROUTES=1)`); await page.close(); continue; }
    await sc.steps(page);
    const file = path.join(OUT, `${name}-${vp}.png`);
    await page.screenshot({ path: file });
    if (name === "menu" && vp === "phone") await page.screenshot({ path: "public/poster.jpg", type: "jpeg", quality: 82 });
    console.log(`${errors.length ? "✗" : "✓"} ${name}-${vp}${errors.length ? "  " + errors.join(" | ") : ""}`);
    failures += errors.length;
    await page.close();
  }
}
await browser.close(); server.close();
if (check && failures) process.exit(1);
