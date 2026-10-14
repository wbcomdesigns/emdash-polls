#!/usr/bin/env node
import { chromium } from "/Users/vapvarun/code/wbcom-services/node_modules/playwright/index.mjs";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:4332";
const OUT = `${process.env.HOME}/work-artifacts/screenshots/2026-10/polls-gate`;
mkdirSync(OUT, { recursive: true });
const notes = [];
const plugin = new URL("..", import.meta.url).pathname;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);

await page.goto(`${BASE}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin/plugins/polls/polls`, {
	waitUntil: "domcontentloaded",
});
await page.waitForTimeout(1500);
const closeWelcome = page.getByRole("button", { name: /close|dismiss/i }).first();
if (await closeWelcome.count()) await closeWelcome.click().catch(() => {});
const gotIt = page.getByRole("button", { name: /Get started|Got it|Close/i }).first();
if (await gotIt.count()) {
	await page.keyboard.press("Escape").catch(() => {});
	await page.locator("button").filter({ hasText: /^×$|^Close$/ }).first().click().catch(() => {});
}
await page.evaluate(() => {
	for (const el of document.querySelectorAll("dialog, [role=dialog], [class*=modal]")) {
		const x = el.querySelector("button");
		if (x) x.click();
	}
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/admin-1440-light-list-clear.png`, fullPage: true });

const body = await page.innerText("body");
notes.push(`admin clear: ${body.slice(0, 280).replace(/\n/g, " | ")}`);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/admin-390-light-list-clear.png`, fullPage: true });
const actions = await page.evaluate(() => {
	const nodes = [...document.querySelectorAll("button")];
	const btn = nodes.find((n) => (n.textContent || "").trim() === "Actions");
	if (!btn) return { found: false };
	const r = btn.getBoundingClientRect();
	return { found: true, right: r.right, vw: innerWidth, h: r.height };
});
notes.push(`390 Actions ${JSON.stringify(actions)}`);

await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(200);

const clicked = await page.evaluate(() => {
	const btn = [...document.querySelectorAll("button")].find((n) => (n.textContent || "").trim() === "Actions");
	if (!btn) return false;
	btn.click();
	return true;
});
notes.push(`clicked Actions ${clicked}`);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/admin-1440-light-menu.png`, fullPage: true });

const pick = async (label) =>
	page.evaluate((name) => {
		const item = [...document.querySelectorAll("button, [role=menuitem], a")].find(
			(n) => (n.textContent || "").trim() === name,
		);
		if (!item) return false;
		item.click();
		return true;
	}, label);

if (await pick("Results")) {
	await page.waitForTimeout(900);
	notes.push(`results: ${(await page.innerText("body")).slice(0, 240).replace(/\n/g, " | ")}`);
	await page.screenshot({ path: `${OUT}/admin-1440-light-results.png`, fullPage: true });
} else notes.push("FAIL Results menu item");

await page.goto(`${BASE}/_emdash/admin/plugins/polls/polls`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.evaluate(() => {
	const btn = [...document.querySelectorAll("button")].find((n) => (n.textContent || "").trim() === "Actions");
	btn?.click();
});
await page.waitForTimeout(300);
if (await pick("Copy")) {
	await page.waitForTimeout(900);
	const text = await page.innerText("body");
	notes.push(`copy saw (copy)=${text.includes("(copy)")} toast=${/Rename this copy/.test(text)}`);
	await page.screenshot({ path: `${OUT}/admin-1440-light-copied.png`, fullPage: true });
} else notes.push("FAIL Copy menu item");

await page.goto(`${BASE}/_emdash/admin/plugins/polls/edit`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const form = await page.innerText("body");
notes.push(`form attach=${/Where it shows/.test(form)} named=${/member's choice/.test(form)}`);
const datePickers = await page.locator('input[type="date"]').count();
notes.push(`form date pickers=${datePickers} utc label=${/Opens at \(UTC\)/.test(form)}`);
if (datePickers !== 2) notes.push("FAIL open and close days are not date pickers");
await page.screenshot({ path: `${OUT}/admin-1440-light-form.png`, fullPage: true });

await page.goto(`${BASE}/_emdash/admin/plugins/polls/polls`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const closedOpen = await page.evaluate(() => {
	const rows = [...document.querySelectorAll("tr, [class*=row], li")];
	const closed = rows.find((n) => /Closed/.test(n.textContent || "") && /Actions/.test(n.textContent || ""));
	if (!closed) return { found: false, open: false };
	const btn = [...closed.querySelectorAll("button")].find((n) => (n.textContent || "").trim() === "Actions");
	btn?.click();
	const items = [...document.querySelectorAll("button, [role=menuitem]")].map((n) => (n.textContent || "").trim());
	return { found: true, open: items.includes("Open"), items: items.slice(0, 12) };
});
notes.push(`closed row Open ${JSON.stringify(closedOpen)}`);
if (!closedOpen.open) notes.push("FAIL closed row missing Open");
await page.screenshot({ path: `${OUT}/admin-1440-light-closed-menu.png`, fullPage: true });

await ctx.close();

spawnSync(`${plugin}scripts/lab-role.sh`, ["subscriber"], { stdio: "inherit" });
const memberCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const member = await memberCtx.newPage();
await member.goto(`${BASE}/_emdash/api/setup/dev-bypass?redirect=/polls-demo`, { waitUntil: "domcontentloaded" });
await member.waitForTimeout(1200);
const namedNotice = await member.evaluate(() => document.body.innerText.includes("visible to the site owner"));
notes.push(`member named notice=${namedNotice}`);
await member.screenshot({ path: `${OUT}/member-1440-light-demo.png`, fullPage: true });
await member.setViewportSize({ width: 390, height: 844 });
await member.waitForTimeout(200);
await member.screenshot({ path: `${OUT}/member-390-light-demo.png`, fullPage: true });
await memberCtx.close();
spawnSync(`${plugin}scripts/lab-role.sh`, ["admin"], { stdio: "inherit" });

await browser.close();
writeFileSync(`${OUT}/NOTES-admin.txt`, `${notes.join("\n")}\n`);
console.log(notes.join("\n"));
