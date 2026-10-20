// Must load before anything that starts the test host: it patches the sandbox bridge.
import { countBridgeCalls, MAX_BRIDGE_CALLS } from "./bridge-count";

import { PluginBridge } from "@emdash-cms/cloudflare/sandbox";
import { afterEach, describe, expect, it } from "vitest";

import { emptyPoll, pollOptionKey, voteRowId } from "../src/lib/polls";
import { POLLS, TALLIES, VOTES } from "../src/lib/types";
import { admin, member, openSite } from "./site";

/**
 * Fixes from the 0.5.0 pre-publish review. Each test makes the race or the state the review found,
 * and fails on the code before the fix.
 */

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	race = null;
	await dispose?.();
	dispose = undefined;
});

type Site = Awaited<ReturnType<typeof openSite>>;
type Row = Record<string, unknown>;
const TEN = Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, label: `Answer ${i}` }));
const TWO = TEN.slice(0, 2);

/**
 * Something that happens at the same moment as a plugin call: it runs right before the plugin's
 * `nth` bridge call of `method`, while that call waits.
 */
let race: { method: string; nth: number; run: (args: unknown[]) => Promise<unknown> } | null = null;
const proto = PluginBridge.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
for (const name of ["storageCount", "storageDeleteMany", "kvCompareAndSet"]) {
	const method = proto[name]!;
	proto[name] = async function (this: unknown, ...args: unknown[]) {
		if (race?.method === name && --race.nth === 0) {
			const run = race.run;
			race = null;
			await run(args);
		}
		return method.apply(this, args);
	};
}

const poll = (overrides: Row = {}): Row => ({
	...emptyPoll("2026-10-13T00:00:00.000Z"),
	question: "Which one?",
	options: TEN,
	status: "open",
	who: "anyone",
	allow_change: true,
	...overrides,
});

async function open(): Promise<Site> {
	const site = await openSite();
	dispose = site.dispose;
	return site;
}

async function vote(site: Site, pollId: string, who: string, optionId: string) {
	await site.rt.fixtures.plugin.storage(VOTES, voteRowId(pollId, who, optionId), {
		poll: pollId,
		poll_option: pollOptionKey(pollId, optionId),
		member_id: who,
		createdAt: "2026-10-14T00:00:00.000Z",
		visitor: "",
		member_name: who,
	});
}

/** A poll as 0.4.0 left it, voter n on answer n % answers. Returns the count per answer. */
async function seed(site: Site, id: string, voters: number, extra: Row = {}): Promise<number[]> {
	const row = poll(extra);
	const answers = (row.options as unknown[]).length;
	await site.rt.fixtures.plugin.storage(POLLS, id, row);
	const expected = Array<number>(answers).fill(0);
	for (let n = 0; n < voters; n += 1) {
		await vote(site, id, `m${n}`, `o${n % answers}`);
		expected[n % answers]! += 1;
	}
	return expected;
}

const get = (site: Site, id: string) =>
	site.call("get", { id }, { method: "GET" }) as Promise<{ ok: boolean; counting?: boolean; results?: { options: Array<{ count: number }> } }>;
const asAdmin = (site: Site, input: Row) => site.call("admin", { page: "/polls", ...input }, site.as(admin));
const listLoad = (site: Site) => asAdmin(site, { type: "page_load" });
const votesOf = async (site: Site, id: string) => (await site.rt.inspect.storage.list(VOTES)).filter((v) => (v.data as Row).poll === id);

async function deletePoll(site: Site, id: string) {
	const row = (await site.rt.inspect.storage.get<Row>(POLLS, id))!;
	return asAdmin(site, { type: "block_action", action_id: "delete_confirm", value: `delete_confirm|${row.rev}|${id}` });
}

async function backdate(site: Site, id: string) {
	const row = (await site.rt.inspect.storage.get<Row>(POLLS, id))!;
	await site.rt.fixtures.plugin.storage(POLLS, id, { ...row, deleted_at: "2020-01-01T00:00:00.000Z" });
}

async function within<T>(run: () => Promise<T>): Promise<T> {
	const { result, calls } = await countBridgeCalls(run);
	expect(calls.length, calls.join(",")).toBeLessThanOrEqual(MAX_BRIDGE_CALLS);
	return result;
}

describe("counting a poll from 0.4.0 with more than 100 votes", () => {
	it("a vote landing while the first answers are counted is not lost", async () => {
		const site = await open();
		const expected = await seed(site, "busy", 150);
		// The vote lands after answer 0 is counted, before anything is stored.
		race = { method: "storageCount", nth: 2, run: () => site.call("vote", { id: "busy", choices: ["o0"] }, site.as(member("late"))) };
		let read = await get(site, "busy");
		expect(race).toBeNull();
		expected[0]! += 1;
		for (let i = 0; i < 3 && read.counting; i += 1) read = await get(site, "busy");
		expect(read.results?.options.map((o) => o.count)).toEqual(expected);
	});

	it("a counting step a vote raced is tried again in the same call", async () => {
		const site = await open();
		const expected = await seed(site, "two", 20, { options: TWO });
		// As Recount leaves it: a record that counts votes, not ready.
		await site.rt.fixtures.plugin.storage(TALLIES, "two", { poll: "two", seq: 0, step: 0, ready: false, a0: 0, a1: 0 });
		race = { method: "storageCount", nth: 1, run: () => site.call("vote", { id: "two", choices: ["o1"] }, site.as(member("late"))) };
		const read = await get(site, "two");
		expect(race).toBeNull();
		expected[1]! += 1;
		expect(read.counting).toBeUndefined();
		expect(read.results?.options.map((o) => o.count)).toEqual(expected);
	});
});

describe("the polls list after deleting", () => {
	it("offers Next when every poll on the first page was deleted", async () => {
		const site = await open();
		for (let i = 0; i < 30; i += 1) {
			await site.rt.fixtures.plugin.storage(POLLS, `p${i}`, poll({ question: `Question ${i}?`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }));
		}
		for (let i = 29; i >= 4; i -= 1) await deletePoll(site, `p${i}`);
		type Blocks = { blocks: Array<{ type: string; title?: string; elements?: Array<{ label: string; value: string }> }> };
		const list = (await within(() => listLoad(site))) as Blocks;
		expect(list.blocks.find((b) => b.type === "empty")?.title).toBe("No polls on this page");
		const next = list.blocks.flatMap((b) => b.elements ?? []).find((e) => e.label === "Next");
		expect(next).toBeDefined();
		const older = JSON.stringify(await asAdmin(site, { type: "block_action", action_id: "page", value: next!.value }));
		for (const i of [0, 1, 2, 3]) expect(older).toContain(`Question ${i}?`);
	});

	it("removes the first hundred votes on the delete screen itself", async () => {
		const site = await open();
		await seed(site, "big", 150);
		await within(() => deletePoll(site, "big"));
		expect(await votesOf(site, "big")).toHaveLength(50);
	});
});

describe("removing a deleted poll", () => {
	it("removes a count record a reader stored after the mark, with the poll row", async () => {
		const site = await open();
		await seed(site, "t", 3, { options: TWO });
		await get(site, "t");
		await deletePoll(site, "t");
		// A reader that loaded the poll just before the mark stores its counts just after.
		await site.rt.fixtures.plugin.storage(TALLIES, "t", { poll: "t", seq: 0, step: 2, ready: true, a0: 2, a1: 1 });
		await backdate(site, "t");
		for (let i = 0; i < 3; i += 1) await within(() => listLoad(site));
		expect(await site.rt.inspect.storage.get(POLLS, "t")).toBeNull();
		expect(await site.rt.inspect.storage.get(TALLIES, "t")).toBeNull();
	});

	it("leaves no vote rows from a vote that loaded the poll before the mark", async () => {
		const site = await open();
		await seed(site, "o", 0, { options: TWO });
		await deletePoll(site, "o");
		await listLoad(site);
		// The vote in flight writes its row after the first list load.
		await vote(site, "o", "late", "o0");
		await backdate(site, "o");
		for (let i = 0; i < 3; i += 1) await listLoad(site);
		expect(await votesOf(site, "o")).toHaveLength(0);
		expect(await site.rt.inspect.storage.get(POLLS, "o")).toBeNull();
	});

	it("removes votes on the dashboard widget, Results and the edit form too", async () => {
		const site = await open();
		await seed(site, "w", 350);
		await seed(site, "kept", 1, { options: TWO, createdAt: "2026-10-12T00:00:00.000Z" });
		await get(site, "kept");
		await deletePoll(site, "w");
		expect(await votesOf(site, "w")).toHaveLength(250);
		await within(() => site.rt.admin.loadWidget("open"));
		expect(await votesOf(site, "w")).toHaveLength(150);
		const kept = (await site.rt.inspect.storage.get<Row>(POLLS, "kept"))!;
		await within(() => asAdmin(site, { type: "block_action", action_id: "poll_mod", value: `results|${kept.rev}|kept` }));
		expect(await votesOf(site, "w")).toHaveLength(50);
		await within(() => site.rt.admin.loadPage("/edit"));
		expect(await votesOf(site, "w")).toHaveLength(0);
	});
});

describe("locks and races", () => {
	it("an erase that loses the rate-limit compare-and-set answers BUSY in one attempt", async () => {
		const site = await open();
		await seed(site, "e", 1, { options: TWO });
		race = { method: "kvCompareAndSet", nth: 1, run: ([key]) => site.rt.fixtures.plugin.kv(String(key), "0|0|0") };
		const { result, calls } = await countBridgeCalls(() => site.call("mine", {}, site.as(member("m0"), "DELETE")));
		expect(result).toMatchObject({ ok: false, error: { code: "BUSY" } });
		expect(calls).toHaveLength(2);
		expect(await votesOf(site, "e")).toHaveLength(1);
	});

	it("an erase and a vote change at the same moment take a vote off the counts once", async () => {
		const site = await open();
		await seed(site, "r", 0, { options: TWO });
		await vote(site, "r", "x", "o0");
		await vote(site, "r", "y", "o0");
		await get(site, "r");
		// After x's erase has read x's rows and before it deletes them, x changes the vote from another tab.
		race = { method: "storageDeleteMany", nth: 1, run: () => site.call("vote", { id: "r", choices: ["o1"] }, site.as(member("x"))) };
		await site.call("mine", {}, site.as(member("x"), "DELETE"));
		expect(race).toBeNull();
		const rows = (await votesOf(site, "r")).map((v) => (v.data as Row).poll_option);
		const tally = (await site.rt.inspect.storage.get<Row>(TALLIES, "r"))!;
		expect([tally.a0, tally.a1]).toEqual([rows.filter((o) => o === "r:o0").length, rows.filter((o) => o === "r:o1").length]);
	});

	it("the owner's Remove votes waits while that member is voting", async () => {
		const site = await open();
		await seed(site, "n", 3, { options: TWO, named: true });
		await site.rt.fixtures.plugin.kv("vote:m1", `${Date.now()}|0|0`);
		const row = (await site.rt.inspect.storage.get<Row>(POLLS, "n"))!;
		const screen = (await within(() => asAdmin(site, { type: "block_action", action_id: "poll_mod", value: `erase|${row.rev}|n|m1` }))) as {
			toast?: { message: string };
		};
		expect(screen.toast?.message).toBe("This member is voting right now. Try again in a moment.");
		expect(await votesOf(site, "n")).toHaveLength(3);
	});

	it("the first guest who loses the race to create the site's salt gets BUSY, not guests-unavailable", async () => {
		const site = await open();
		await seed(site, "g", 0, { options: TWO });
		race = { method: "kvCompareAndSet", nth: 1, run: () => site.rt.fixtures.plugin.kv("visitor-salt", "made-by-another-guest") };
		const result = await site.call("vote_guest", { id: "g", choices: ["o0"] }, { method: "POST", meta: { ip: "203.0.113.5", userAgent: null, referer: null, geo: null } });
		expect(result).toEqual({ ok: false, error: { code: "BUSY" } });
	});
});
