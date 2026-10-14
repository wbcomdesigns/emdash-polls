#!/usr/bin/env node
/** Take the 1440x900 visitor screenshot the registry listing uses first. */
import { chromium } from "/Users/vapvarun/code/wbcom-services/node_modules/playwright/index.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:4332";
const OUT = new URL("../images/screenshot-1-poll.png", import.meta.url).pathname;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const page = await ctx.newPage();
await page.goto(`${BASE}/polls-demo`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
const single = page.locator("[data-wbp]").first();
await single.locator("label", { hasText: "Blue" }).click();
await single.getByRole("button", { name: "Vote" }).click();
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: OUT, fullPage: false });
await browser.close();
console.log(`wrote ${OUT}`);
