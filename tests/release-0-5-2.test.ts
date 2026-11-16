import { afterEach, describe, expect, it } from "vitest";

import { kitCommand, shortQuestion } from "../src/admin";
import { emptyPoll } from "../src/lib/polls";
import { POLLS, VOTES } from "../src/lib/types";
import { assertBlocks } from "./block-check";
import { admin, ana, member, openSite, withPosts } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

const editor = member("eddie", 40);
const DAY = 24 * 60 * 60 * 1000;

const poll = (overrides: Record<string, unknown> = {}) => ({
	...emptyPoll("2026-11-13T00:00:00.000Z"),
	question: "Tea or coffee?",
	options: [
		{ id: "tea", label: "Tea" },
		{ id: "coffee", label: "Coffee" },
	],
	status: "open",
	who: "members",
	allow_change: true,
	...overrides,
});

type Blocks = { blocks: Array<Record<string, unknown>>; toast?: { message: string; type: string } };

async function site() {
	const s = await openSite();
	dispose = s.dispose;
	const adminCall = async (input: Record<string, unknown>) => (await s.call("admin", input, s.as(admin))) as Blocks;
	return { ...s, adminCall };
}

describe("0.5.2 #74: erasing your own votes is never refused by the vote limit", () => {
	it("erases after the hourly vote limit is used up, and leaves the vote count as it was", async () => {
		const s = await site();
		await s.rt.fixtures.plugin.storage(POLLS, "p", poll());
		expect(await s.call("vote", { id: "p", choices: ["tea"] }, s.as(ana))).toMatchObject({ ok: true });
		// The rest of this hour's 8 vote writes are used.
		const start = Date.now() - 60_000;
		await s.rt.fixtures.plugin.kv("vote:ana", `0|${start}|8`);
		expect(await s.call("vote", { id: "p", choices: ["coffee"] }, s.as(ana))).toMatchObject({ error: { code: "RATE_LIMITED" } });

		expect(await s.call("mine", {}, s.as(ana, "DELETE"))).toMatchObject({ ok: true, erased: 1 });
		expect((await s.rt.inspect.storage.list(VOTES)).length).toBe(0);
		// Erasing did not add to (or reset) the vote count: voting is still limited.
		expect(await s.rt.inspect.kv.get("vote:ana")).toBe(`0|${start}|8`);
		// And erasing again with nothing left still answers ok.
		expect(await s.call("mine", {}, s.as(ana, "DELETE"))).toMatchObject({ ok: true, erased: 0 });
	});

	it("still answers BUSY while a vote of the same member holds the lock", async () => {
		const s = await site();
		await s.rt.fixtures.plugin.kv("vote:ana", `${Date.now()}|0|0`);
		expect(await s.call("mine", {}, s.as(ana, "DELETE"))).toMatchObject({ error: { code: "BUSY" } });
	});
});

describe("0.5.2 #71: two answers with the same text are refused", () => {
	const answers = { answer_1: "same", answer_2: "Same " };

	it("on the admin form, new and edited", async () => {
		const s = await site();
		const created = await s.adminCall({ type: "form_submit", action_id: "save||", values: { question: "Dup?", ...answers } });
		expect(created.toast).toMatchObject({ type: "error", message: "Give each answer different text." });
		expect((await s.rt.inspect.storage.list(POLLS)).length).toBe(0);

		// A poll with votes keeps its answers, but cannot be renamed into two equal ones either.
		await s.rt.fixtures.plugin.storage(POLLS, "p", poll({ rev: "r1" }));
		await s.call("vote", { id: "p", choices: ["tea"] }, s.as(ana));
		const edited = await s.adminCall({ type: "form_submit", action_id: "save|r1|p", values: { question: "Tea?", answer_1: "Tea", answer_2: "tea" } });
		expect(edited.toast).toMatchObject({ type: "error", message: "Give each answer different text." });
	});

	it("in the editor's Poll panel", async () => {
		const s = await site();
		const posts = await withPosts(s.rt);
		const res = await s.rt.admin.submitEditorPanel("poll", "posts", posts.live, "create", { question: "Dup?", ...answers }, { user: editor } as never);
		assertBlocks("panel", res, []);
		expect(res.toast).toMatchObject({ type: "error", message: "Give each answer different text." });
	});
});

describe("0.5.2 #75: a poll whose closing date has passed", () => {
	it("is not reported as opened from the list or the panel", async () => {
		const s = await site();
		const posts = await withPosts(s.rt);
		const closes_at = new Date(Date.now() - DAY).toISOString();
		await s.rt.fixtures.plugin.storage(POLLS, "p", poll({ status: "draft", closes_at, rev: "r1", attach: "entry", attach_key: `posts:${posts.live}` }));

		const listed = await s.adminCall({ type: "block_action", action_id: "poll_mod", value: "open|r1|p" });
		expect(listed.toast).toMatchObject({ type: "error" });
		expect(listed.toast?.message).toContain("closing date has passed");
		expect(await s.rt.inspect.storage.get(POLLS, "p")).toMatchObject({ status: "draft", rev: "r1" });

		const panel = await s.rt.admin.actEditorPanel("poll", "posts", posts.live, "open", { user: editor } as never);
		expect(panel.toast?.message).toContain("closing date has passed");
		expect(await s.rt.inspect.storage.get(POLLS, "p")).toMatchObject({ status: "draft" });
	});

	it("cannot be saved with a closing date in the past or before the opening date", async () => {
		const s = await site();
		const base = { question: "When?", answer_1: "A", answer_2: "B" };
		const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
		const past = await s.adminCall({ type: "form_submit", action_id: "save||", values: { ...base, closes_date: yesterday, closes_time: "12:00" } });
		expect(past.toast?.message).toBe("That closing date has passed. Pick a later one, or leave it empty.");

		const later = new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10);
		const sooner = new Date(Date.now() + 5 * DAY).toISOString().slice(0, 10);
		const order = await s.adminCall({
			type: "form_submit",
			action_id: "save||",
			values: { ...base, opens_date: later, opens_time: "09:00", closes_date: sooner, closes_time: "09:00" },
		});
		expect(order.toast?.message).toBe("The poll has to close after it opens.");
		expect((await s.rt.inspect.storage.list(POLLS)).length).toBe(0);
	});

	it("keeps an existing past closing date when the owner edits something else", async () => {
		const s = await site();
		const closes_at = new Date(Date.now() - DAY).toISOString();
		await s.rt.fixtures.plugin.storage(POLLS, "p", poll({ status: "closed", closes_at, rev: "r1" }));
		const [date, time] = [closes_at.slice(0, 10), closes_at.slice(11, 16)];
		const saved = await s.adminCall({
			type: "form_submit",
			action_id: "save|r1|p",
			values: { question: "Renamed?", answer_1: "Tea", answer_2: "Coffee", closes_date: date, closes_time: time },
		});
		expect(saved.toast?.message).toBe("Poll saved.");
	});
});

describe("0.5.2 #73: install command prints no detached HEAD advice", () => {
	it("turns the advice off and keeps six lines of 52 characters or fewer", () => {
		const lines = kitCommand("v0.5.2").split("\n");
		expect(lines).toHaveLength(6);
		expect(lines[1]).toContain("-c advice.detachedHead=false clone");
		for (const line of lines) expect(line.length).toBeLessThanOrEqual(52);
	});
});

describe("0.5.2 #72: the polls list fits a phone", () => {
	it("puts Status and Actions right after the question and shortens a long question", async () => {
		const s = await site();
		const long = `${"A very long question about the garden ".repeat(4)}end?`;
		await s.rt.fixtures.plugin.storage(POLLS, "p", poll({ question: long }));
		const list = await s.adminCall({ type: "page_load", page: "/polls" });
		const table = list.blocks.find((b) => b.type === "table") as { columns: Array<{ key: string }>; rows: Array<{ poll: string }> };
		expect(table.columns.map((c) => c.key).slice(0, 3)).toEqual(["poll", "status", "action"]);
		expect(table.rows[0]?.poll.length).toBeLessThanOrEqual(61);
		expect(table.rows[0]?.poll.endsWith("…")).toBe(true);
		expect(shortQuestion("Short?")).toBe("Short?");
		expect(shortQuestion("")).toBe("Untitled poll");
	});
});

describe("0.5.2 #62: list actions keep the search, the panel can search", () => {
	it("Close answers with the same search", async () => {
		const s = await site();
		await s.rt.fixtures.plugin.storage(POLLS, "p1", poll({ question: "Zebra stripes?", createdAt: "2026-11-01T00:00:00.000Z" }));
		await s.rt.fixtures.plugin.storage(POLLS, "p2", poll({ question: "Lunch?", createdAt: "2026-11-02T00:00:00.000Z" }));
		const found = await s.adminCall({ type: "form_submit", action_id: "find", values: { q: "zebra" } });
		const table = found.blocks.find((b) => b.type === "table") as { rows: Array<{ action: { items: Array<{ label: string; value: string }> } }> };
		const close = table.rows[0]?.action.items.find((i) => i.label === "Close");
		const after = await s.adminCall({ type: "block_action", action_id: "poll_mod", value: close?.value });
		expect(after.toast?.message).toBe("Poll closed.");
		expect(JSON.stringify(after.blocks)).toContain("Zebra stripes?");
		expect(JSON.stringify(after.blocks)).not.toContain("Lunch?");
		expect(JSON.stringify(after.blocks)).toContain('"initial_value":"zebra"');
	});

	it("the Poll panel finds an older poll by its question", async () => {
		const s = await site();
		const posts = await withPosts(s.rt);
		await s.rt.fixtures.plugin.storage(POLLS, "old", poll({ question: "Oldest heron?", createdAt: "2026-01-01T00:00:00.000Z" }));
		for (let i = 0; i < 30; i += 1) {
			await s.rt.fixtures.plugin.storage(POLLS, `n${i}`, poll({ question: `Newer ${i}?`, createdAt: `2026-11-${String(i % 28 + 1).padStart(2, "0")}T00:00:00.000Z` }));
		}
		const as = { user: editor } as never;
		const plain = await s.rt.admin.loadEditorPanel("poll", "posts", posts.live, as);
		expect(JSON.stringify(plain.blocks)).not.toContain("Oldest heron?");
		const found = await s.rt.admin.submitEditorPanel("poll", "posts", posts.live, "find_poll", { q: "heron" }, as);
		assertBlocks("panel find", found, []);
		expect(JSON.stringify(found.blocks)).toContain("Oldest heron?");
		const none = await s.rt.admin.submitEditorPanel("poll", "posts", posts.live, "find_poll", { q: "zzz" }, as);
		expect(JSON.stringify(none.blocks)).toContain('No poll you can attach matches \\"zzz\\".');
	});
});
