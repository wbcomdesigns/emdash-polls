#!/usr/bin/env node
/** Isolated Chromium walk of the polls lab. Not a product file. */
import { chromium } from "/Users/vapvarun/code/wbcom-services/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:4332";
const OUT = `${process.env.HOME}/work-artifacts/screenshots/2026-10/polls-gate`;
mkdirSync(OUT, { recursive: true });

const notes = [];
const shot = async (page, name) => {
	await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
	notes.push(`shot ${name}`);
};

const contrast = (fg, bg) => {
	const lum = (c) => {
		const v = c.map((n) => {
			const s = n / 255;
			return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
	};
	const L1 = lum(fg);
	const L2 = lum(bg);
	return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};

const browser = await chromium.launch({ headless: true });
const guest = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const page = await guest.newPage();

await page.goto(`${BASE}/polls-mine`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const guestMine = await page.locator("[data-wbp-mine]").innerText();
notes.push(`guest mine: ${guestMine.slice(0, 180).replace(/\n/g, " | ")}`);
if (!/Sign in to see your votes/.test(guestMine)) notes.push("FAIL guest mine missing sign-in");
await shot(page, "guest-1440-light-mine");

await page.goto(`${BASE}/polls-demo`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const guestText = await page.locator(".wb").first().innerText();
notes.push(`guest 1440 light: ${guestText.slice(0, 180).replace(/\n/g, " | ")}`);
if (!/Which colour should we ship/.test(guestText)) notes.push("FAIL guest missing single poll");
if (!/Which extras do you want/.test(await page.content())) notes.push("FAIL guest missing multi poll");
if (/0% · 0 votes/.test(guestText) && /Vote/.test(guestText)) notes.push("FAIL answers shown twice before vote");
if (!/This poll is closed/.test(await page.content())) notes.push("FAIL guest missing closed copy");
if (!/This poll is not available/.test(await page.content())) notes.push("FAIL guest missing not-found");
const closedBox = page.locator("[data-wbp]").filter({ hasText: "This poll is closed" }).first();
if (await closedBox.count()) {
	const closedText = await closedBox.innerText();
	notes.push(`closed poll: ${closedText.slice(0, 160).replace(/\n/g, " | ")}`);
	if (/Vote/.test(closedText) && !/You voted/.test(closedText)) notes.push("FAIL closed poll still has Vote");
} else notes.push("FAIL closed poll box missing");
const flush = await page.evaluate(() => {
	const opt = document.querySelector(".wbp-option");
	const field = document.querySelector(".wbp-options");
	if (!opt || !field) return null;
	const o = opt.getBoundingClientRect();
	const f = field.getBoundingClientRect();
	return { leftGap: Math.round(o.left - f.left), pad: getComputedStyle(field).paddingLeft };
});
notes.push(`option flush ${JSON.stringify(flush)}`);
if (flush && flush.leftGap > 8) notes.push("FAIL option rows inset");
await page.goto(`${BASE}/account/votes`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const guestVotes = await page.locator("[data-wbp-mine]").innerText();
notes.push(`guest account/votes: ${guestVotes.slice(0, 160).replace(/\n/g, " | ")}`);
if (!/Sign in to see your votes/.test(guestVotes)) notes.push("FAIL /account/votes guest missing sign-in");
await shot(page, "guest-1440-light-account-votes");
await page.goto(`${BASE}/polls-demo`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await shot(page, "guest-1440-light-demo");

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
if (overflow) notes.push("FAIL sideways scroll 1440 guest");

const single = page.locator("[data-wbp]").first();
await single.getByRole("button", { name: "Vote" }).click();
await page.waitForTimeout(400);
const emptyVote = await page.locator("[data-wbp-status]").first().innerText();
notes.push(`empty vote status: ${emptyVote}`);
if (!/Pick an answer/.test(emptyVote)) notes.push("FAIL empty vote did not show pick error");
await single.locator("label", { hasText: "Blue" }).click();
await single.getByRole("button", { name: "Vote" }).click();
await page.waitForTimeout(800);
const afterVote = await single.innerText();
const afterStatus = await page.locator("[data-wbp-status]").first().evaluate((el) => ({
	hidden: el.hidden,
	text: el.textContent,
	tone: el.dataset.tone || "",
}));
notes.push(`guest voted: ${afterVote.slice(0, 160).replace(/\n/g, " | ")}`);
notes.push(`status after vote: ${JSON.stringify(afterStatus)}`);
if (!/You voted|vote/.test(afterVote)) notes.push("FAIL guest vote did not confirm");
if (!afterStatus.hidden && /Pick an answer/.test(afterStatus.text || "")) notes.push("FAIL pick error stayed after vote");
await shot(page, "guest-1440-light-voted");

await page.setViewportSize({ width: 768, height: 900 });
await page.waitForTimeout(200);
if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)) {
	notes.push("FAIL sideways scroll 768 guest");
}
await shot(page, "guest-768-light-demo");

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)) {
	notes.push("FAIL sideways scroll 390 guest");
}
const tap = await page.evaluate(() => {
	const btn = document.querySelector(".wb-btn");
	if (!btn) return 0;
	return btn.getBoundingClientRect().height;
});
notes.push(`vote button height ${tap}px`);
if (tap && tap < 40) notes.push("FAIL tap target under 40px");
await shot(page, "guest-390-light-demo");

await guest.close();
const dark = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const darkPage = await dark.newPage();
await darkPage.goto(`${BASE}/polls-demo`, { waitUntil: "domcontentloaded" });
await darkPage.waitForTimeout(800);
const colors = await darkPage.evaluate(() => {
	const h2 = document.querySelector(".wb h2");
	if (!h2) return null;
	const cs = getComputedStyle(h2);
	const parse = (v) => (v.match(/\d+/g) || []).slice(0, 3).map(Number);
	return { fg: parse(cs.color), bg: parse(getComputedStyle(h2.closest(".wb")).backgroundColor || getComputedStyle(document.body).backgroundColor) };
});
if (colors?.fg) {
	const ratio = contrast(colors.fg, colors.bg[0] ? colors.bg : [18, 18, 18]);
	notes.push(`dark h2 rgb(${colors.fg}) on rgb(${colors.bg}) contrast ${ratio.toFixed(2)}`);
	if (ratio < 4.5) notes.push("FAIL dark contrast under 4.5");
	if (colors.fg[0] < 200) notes.push("FAIL dark text still looks light-theme");
}
await shot(darkPage, "guest-1440-dark-demo");
await dark.close();

const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const admin = await adminCtx.newPage();
await admin.goto(`${BASE}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin/plugins/polls/polls`, {
	waitUntil: "networkidle",
});
await admin.waitForTimeout(1200);
const adminText = await admin.locator("body").innerText();
notes.push(`admin list: ${adminText.slice(0, 240).replace(/\n/g, " | ")}`);
if (!/Which colour should we ship/.test(adminText)) notes.push("FAIL admin list missing seeded poll");
if (!/Actions/.test(adminText)) notes.push("FAIL admin list missing Actions");
await shot(admin, "admin-1440-light-list");

await admin.setViewportSize({ width: 390, height: 844 });
await admin.waitForTimeout(400);
const actionsBox = await admin.evaluate(() => {
	const labels = [...document.querySelectorAll("button, [role=button], td, th")];
	const el = labels.find((node) => /Actions/.test(node.textContent || ""));
	if (!el) return null;
	const r = el.getBoundingClientRect();
	return { x: r.x, right: r.right, vw: window.innerWidth, text: el.textContent?.slice(0, 40) };
});
notes.push(`admin 390 Actions box ${JSON.stringify(actionsBox)}`);
if (!actionsBox) notes.push("FAIL Actions not found at 390");
else if (actionsBox.right > actionsBox.vw + 2) notes.push("FAIL Actions off-screen at 390");
if (await admin.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8)) {
	notes.push("FAIL admin sideways scroll 390");
}
await shot(admin, "admin-390-light-list");

await admin.setViewportSize({ width: 1440, height: 900 });
const clickMenu = async (label) =>
	admin.evaluate((name) => {
		const btn = [...document.querySelectorAll("button")].find((n) => (n.textContent || "").trim() === "Actions");
		btn?.click();
		const item = [...document.querySelectorAll("button, [role=menuitem], a")].find(
			(n) => (n.textContent || "").trim() === name,
		);
		if (!item) return false;
		item.click();
		return true;
	}, label);
if (await clickMenu("Results")) {
	await admin.waitForTimeout(800);
	const resultsText = await admin.locator("body").innerText();
	notes.push(`results: ${resultsText.slice(0, 220).replace(/\n/g, " | ")}`);
	if (!/Votes|Share|vote/.test(resultsText)) notes.push("FAIL results missing bars");
	await shot(admin, "admin-1440-light-results");
} else {
	notes.push("FAIL could not open Results menu");
}

await admin.goto(`${BASE}/_emdash/admin/plugins/polls/polls`, { waitUntil: "domcontentloaded" });
await admin.waitForTimeout(800);
if (await clickMenu("Copy")) {
	await admin.waitForTimeout(800);
	const copied = await admin.locator("body").innerText();
	notes.push(`copy form=${/Edit poll/.test(copied)} suffix=${copied.includes("(copy)")} toast=${/Rename this copy/.test(copied)}`);
	if (!/Edit poll/.test(copied) || !copied.includes("(copy)")) notes.push("FAIL copy did not open edit with (copy)");
	await shot(admin, "admin-1440-light-copied");
} else notes.push("FAIL Copy menu missing");

await admin.goto(`${BASE}/_emdash/admin/plugins/polls/edit`, { waitUntil: "domcontentloaded" });
await admin.waitForTimeout(800);
const form = await admin.locator("body").innerText();
notes.push(`form has attach? ${/Where it shows|content type/.test(form)}`);
await shot(admin, "admin-1440-light-form");

await adminCtx.close();

const plugin = new URL("..", import.meta.url).pathname;
spawnSync(`${plugin}scripts/lab-role.sh`, ["subscriber"], { stdio: "inherit" });
const memberCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const member = await memberCtx.newPage();
await member.goto(`${BASE}/_emdash/api/setup/dev-bypass?redirect=/polls-demo`, { waitUntil: "domcontentloaded" });
await member.waitForTimeout(1000);
const named = member.locator("[data-wbp]").nth(1);
const namedText = await named.innerText().catch(() => "");
notes.push(`member named poll: ${namedText.slice(0, 180).replace(/\n/g, " | ")}`);
if (!/visible to the site owner/.test(await member.content())) notes.push("WARN named notice not seen (maybe already voted as same account)");
const voteBtn = named.getByRole("button", { name: /Vote|Change vote/ });
if (await voteBtn.count()) {
	const opt = named.locator("label").first();
	if (await opt.count()) await opt.click();
	await voteBtn.click();
	await member.waitForTimeout(800);
	notes.push(`member voted: ${(await named.innerText()).slice(0, 140).replace(/\n/g, " | ")}`);
}
await shot(member, "member-1440-light-demo");

await member.goto(`${BASE}/account/votes`, { waitUntil: "domcontentloaded" });
await member.waitForTimeout(1000);
const mineText = await member.locator("[data-wbp-mine]").innerText();
notes.push(`member account/votes: ${mineText.slice(0, 240).replace(/\n/g, " | ")}`);
if (!/You chose |You have not voted/.test(mineText)) notes.push("FAIL member /account/votes missing list or empty");
await shot(member, "member-1440-light-account-votes");
await member.goto(`${BASE}/polls-mine`, { waitUntil: "domcontentloaded" });
await member.waitForTimeout(800);
await shot(member, "member-1440-light-mine");
await member.setViewportSize({ width: 390, height: 844 });
await member.waitForTimeout(300);
const mineOverflow = await member.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
if (mineOverflow) notes.push("FAIL sideways scroll 390 mine");
await shot(member, "member-390-light-mine");
await member.setViewportSize({ width: 1440, height: 900 });
await member.emulateMedia({ colorScheme: "dark" });
await member.waitForTimeout(300);
const mineDark = await member.evaluate(() => {
	const h2 = document.querySelector("[data-wbp-mine] h2");
	const box = document.querySelector("[data-wbp-mine]");
	if (!h2 || !box) return null;
	const fg = getComputedStyle(h2).color.match(/\d+/g)?.map(Number) ?? [];
	const bg = getComputedStyle(box).backgroundColor.match(/\d+/g)?.map(Number) ?? [];
	return { fg, bg };
});
if (mineDark?.fg?.length) {
	const ratio = contrast(mineDark.fg, mineDark.bg[0] ? mineDark.bg : [18, 18, 18]);
	notes.push(`mine dark h2 rgb(${mineDark.fg}) on rgb(${mineDark.bg}) contrast ${ratio.toFixed(2)}`);
	if (ratio < 4.5) notes.push("FAIL mine dark contrast under 4.5");
}
await shot(member, "member-1440-dark-mine");
await member.emulateMedia({ colorScheme: "light" });
const erase = member.getByRole("button", { name: "Delete my votes" });
if (await erase.count()) {
	await erase.click();
	await member.waitForTimeout(200);
	const armed = member.getByRole("button", { name: "Click again to delete them for good" });
	if (await armed.count()) {
		await armed.click();
		await member.waitForTimeout(800);
		const afterErase = await member.locator("[data-wbp-mine]").innerText();
		notes.push(`member mine after erase: ${afterErase.slice(0, 200).replace(/\n/g, " | ")}`);
		if (!/You have not voted in any polls yet/.test(afterErase)) notes.push("FAIL member mine did not empty");
		await shot(member, "member-1440-light-mine-erased");
		await member.goto(`${BASE}/polls-demo`, { waitUntil: "domcontentloaded" });
		await member.waitForTimeout(1000);
		const extras = member.locator("[data-wbp]").nth(1);
		const extrasText = await extras.innerText();
		notes.push(`extras after erase: ${extrasText.slice(0, 160).replace(/\n/g, " | ")}`);
		if (/You voted/.test(extrasText) || /1 vote/.test(extrasText)) notes.push("FAIL extras vote still present after erase");
		if (!/Vote/.test(extrasText)) notes.push("FAIL extras did not return to the vote form");
	} else notes.push("FAIL erase did not arm");
} else notes.push("WARN no erase button (empty list)");
await memberCtx.close();
spawnSync(`${plugin}scripts/lab-role.sh`, ["admin"], { stdio: "inherit" });

await browser.close();
writeFileSync(`${OUT}/NOTES.txt`, `${notes.join("\n")}\n`);
console.log(notes.join("\n"));
console.log(`shots in ${OUT}`);
