import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:3010/";
const out = process.argv[3] || "hero-shot.png";
const w = parseInt(process.argv[4] || "1440", 10);
const h = parseInt(process.argv[5] || "900", 10);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log("saved", out);
