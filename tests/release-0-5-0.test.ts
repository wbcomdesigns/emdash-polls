// Must load before anything that starts the test host: it patches the sandbox bridge.
import { countBridgeCalls, MAX_BRIDGE_CALLS } from "./bridge-count";

import { afterEach, describe, expect, it } from "vitest";

import { emptyPoll, pollOptionKey, voteRowId } from "../src/lib/polls";
import { POLLS, TALLIES, VOTES } from "../src/lib/types";
import { admin, member, openSite, withPosts } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

type Site = Awaited<ReturnType<typeof openSite>>;
type Row = Record<string, unknown>;
const TEN = Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, label: `Answer ${i}` }));

const poll = (overrides: Row = {}): Row => ({
	...emptyPoll("2026-10-13T00:00:00.000Z"),
	question: "Which one?",
	options: TEN,
	status: "open",
	who: "anyone",
	...overrides,
});

/** A poll as 0.4.0 left it: the poll row and its vote rows, no stored counts. Voter n picks answer n % 10 (and n % 7 too when `two`). */
async function seed040(site: Site, id: string, voters: number, extra: Row = {}, two = false): Promise<number[]> {
	await site.rt.fixtures.plugin.storage(POLLS, id, poll({ multiple: two, ...extra }));
	const expected = Array<number>(10).fill(0);
	for (let n = 0; n < voters; n += 1) {
		for (const i of new Set(two ? [n % 10, n % 7] : [n % 10])) {
			await site.rt.fixtures.plugin.storage(VOTES, voteRowId(id, `m${n}`, `o${i}`), {
				poll: id,
				poll_option: pollOptionKey(id, `o${i}`),
				member_id: `m${n}`,
				createdAt: "2026-10-14T00:00:00.000Z",
				visitor: "",
				member_name: `Member ${n}`,
			});
			expected[i]! += 1;
		}
	}
	return expected;
}

/** One plugin call, asserting it fits Cloudflare's budget. */
async function within<T>(run: () => Promise<T>): Promise<T> {
	const { result, calls } = await countBridgeCalls(run);
	expect(calls.length, calls.join(",")).toBeLessThanOrEqual(MAX_BRIDGE_CALLS);
	return result;
}

const get = (site: Site, id: string) =>
	within(() => site.call("get", { id }, { method: "GET" })) as Promise<{ ok: boolean; counting?: boolean; results?: { total: number; options: Array<{ count: number }> } }>;

describe("a site updated from 0.4.0", () => {
	it("counts a 500-vote poll in steps: no numbers until every answer is counted, then exact ones", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const expected = await seed040(site, "big", 250, { named: true }, true);
		expect(expected.reduce((a, b) => a + b, 0)).toBeGreaterThan(400);

		const first = await get(site, "big");
		expect(first).toMatchObject({ ok: true, counting: true });
		expect(first.results).toBeUndefined();

		const second = await get(site, "big");
		expect(second.counting).toBeUndefined();
		expect(second.results?.options.map((o) => o.count)).toEqual(expected);
		expect(second.results?.total).toBe(expected.reduce((a, b) => a + b, 0));

		// From here a vote keeps the counts exact in the same step.
		const voted = (await within(() => site.call("vote", { id: "big", choices: ["o3"] }, site.as(member("new"))))) as typeof second;
		expected[3]! += 1;
		expect(voted.results?.options.map((o) => o.count)).toEqual(expected);
		// And the admin list shows the stored total.
		const list = (await within(() => site.call("admin", { type: "page_load", page: "/polls" }, site.as(admin)))) as {
			blocks: Array<{ type: string; rows?: Array<{ votes: string }> }>;
		};
		expect(list.blocks.find((b) => b.type === "table")?.rows?.[0]?.votes).toBe(String(expected.reduce((a, b) => a + b, 0)));
	});

	it("counts a poll of up to 100 vote rows on its first read", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const expected = await seed040(site, "small", 60);
		expect((await get(site, "small")).results?.options.map((o) => o.count)).toEqual(expected);
	});

	it("counts the older polls on the admin list in one load, without a visitor reading them", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await seed040(site, "a", 3, { createdAt: "2026-10-13T01:00:00.000Z" });
		await seed040(site, "b", 0, { createdAt: "2026-10-13T02:00:00.000Z" });
		await seed040(site, "c", 12, { createdAt: "2026-10-13T03:00:00.000Z" });
		const list = (await within(() => site.call("admin", { type: "page_load", page: "/polls" }, site.as(admin)))) as {
			blocks: Array<{ type: string; rows?: Array<{ votes: string }> }>;
		};
		expect(list.blocks.find((b) => b.type === "table")?.rows?.map((r) => r.votes)).toEqual(["12", "0", "3"]);
		expect(await site.rt.inspect.storage.get(TALLIES, "a")).toMatchObject({ ready: true, a0: 1, a1: 1, a2: 1 });
	});

	it("takes a vote on a poll nobody has read since the update, and counts it once read", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const expected = await seed040(site, "quiet", 5);
		const voted = await within(() => site.call("vote", { id: "quiet", choices: ["o9"] }, site.as(member("first"))));
		expect(voted).toMatchObject({ ok: true, choices: ["o9"], counting: true });
		expected[9]! += 1;
		expect((await get(site, "quiet")).results?.options.map((o) => o.count)).toEqual(expected);
	});

	it("recounts on request and lands on the same numbers", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const expected = await seed040(site, "big", 300);
		await get(site, "big");
		await get(site, "big");
		const row = (await site.rt.inspect.storage.get<Row>(POLLS, "big"))!;
		const recount = { type: "block_action", action_id: "poll_mod", value: `recount|${row.rev}|big`, page: "/polls" };
		let screen = JSON.stringify(await within(() => site.call("admin", recount, site.as(admin))));
		for (let i = 0; i < 3 && screen.includes("Continue counting"); i += 1) {
			screen = JSON.stringify(
				await within(() => site.call("admin", { ...recount, value: `results|${row.rev}|big` }, site.as(admin))),
			);
		}
		expect(screen).not.toContain("Continue counting");
		expect((await get(site, "big")).results?.options.map((o) => o.count)).toEqual(expected);
	});
});

describe("reads never write", () => {
	it("an open poll past its closing time reads as closed and its row is left alone", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		await seed040(site, "late", 0, { closes_at: "2020-01-01T00:00:00.000Z", attach: "entry", attach_key: `posts:${posts.live}` });
		await get(site, "late");
		const before = await site.rt.inspect.storage.get<Row>(POLLS, "late");
		expect(await get(site, "late")).toMatchObject({ ok: true, poll: { status: "closed" } });
		expect(await within(() => site.call("slot", { collection: "posts", id: posts.live }, { method: "GET" }))).toMatchObject({ poll: { status: "closed" } });
		expect(await site.rt.inspect.storage.get<Row>(POLLS, "late")).toEqual(before);
	});
});

describe("deleting a poll", () => {
	it("hides it everywhere at once and removes its votes over later list loads", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		await seed040(site, "gone", 230, { attach: "site" });
		await seed040(site, "kept", 1, { question: "Kept?", createdAt: "2026-10-12T00:00:00.000Z" });
		const row = (await site.rt.inspect.storage.get<Row>(POLLS, "gone"))!;
		await within(() =>
			site.call("admin", { type: "block_action", action_id: "delete_confirm", value: `delete_confirm|${row.rev}|gone`, page: "/polls" }, site.as(admin)),
		);
		expect(await site.call("get", { id: "gone" }, { method: "GET" })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
		expect(await site.call("get", { latest: true }, { method: "GET" })).toMatchObject({ poll: { id: "kept" } });
		expect(await site.call("slot", { collection: "posts", id: posts.live }, { method: "GET" })).toEqual({ ok: true });
		expect(await site.call("mine", {}, site.as(member("m1"), "GET"))).toEqual({ ok: true, items: [] });
		const load = () => within(() => site.call("admin", { type: "page_load", page: "/polls" }, site.as(admin)));
		expect(JSON.stringify(await load())).not.toContain("Which one?");
		for (let i = 0; i < 3; i += 1) await load();
		expect((await site.rt.inspect.storage.list(VOTES)).filter((v) => (v.data as Row).poll === "gone")).toHaveLength(0);
		await load();
		expect(await site.rt.inspect.storage.get(POLLS, "gone")).toBeNull();
	});
});

describe("My votes", () => {
	it("erases more than one call can in steps the kit repeats, and the counts follow", async () => {
		const site = await openSite();
		dispose = site.dispose;
		// One member with a vote in 350 polls: 350 rows, more than three pages.
		for (let i = 0; i < 350; i += 1) {
			const id = `p${String(i).padStart(3, "0")}`;
			await site.rt.fixtures.plugin.storage(POLLS, id, poll({ options: TEN.slice(0, 2) }));
			await site.rt.fixtures.plugin.storage(VOTES, voteRowId(id, "heavy", "o0"), {
				poll: id,
				poll_option: pollOptionKey(id, "o0"),
				member_id: "heavy",
				createdAt: "2026-10-14T00:00:00.000Z",
				visitor: "",
				member_name: "",
			});
		}
		expect((await get(site, "p000")).results?.total).toBe(1);
		const first = await within(() => site.call("mine", {}, site.as(member("heavy"), "DELETE")));
		expect(first).toMatchObject({ ok: false, erased: 300, error: { code: "BUSY", reason: "MORE" } });
		const second = await within(() => site.call("mine", {}, site.as(member("heavy"), "DELETE")));
		expect(second).toMatchObject({ ok: true, erased: 50 });
		expect((await get(site, "p000")).results?.total).toBe(0);
	});
});

describe("admin search on a site with many polls", () => {
	it("offers Next when the newest polls hold no match, and Next reaches an older match", async () => {
		const site = await openSite();
		dispose = site.dispose;
		for (let i = 0; i < 320; i += 1) {
			await site.rt.fixtures.plugin.storage(
				POLLS,
				`p${i}`,
				poll({ question: i === 0 ? "Zebra crossing?" : `Question ${i}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }),
			);
		}
		type Blocks = { blocks: Array<{ type: string; elements?: Array<{ label: string; value: string }> }> };
		const next = (screen: Blocks) =>
			screen.blocks.flatMap((block) => block.elements ?? []).find((element) => element.label === "Next");
		let screen = (await site.call("admin", { type: "form_submit", action_id: "find", values: { q: "zebra" } }, site.as(admin))) as Blocks;
		expect(JSON.stringify(screen.blocks)).toContain("No match among the newest polls");
		for (let step = 0; step < 3 && !JSON.stringify(screen.blocks).includes("Zebra crossing?"); step += 1) {
			const button = next(screen);
			expect(button).toBeDefined();
			screen = (await site.call("admin", { type: "block_action", action_id: "page", value: button!.value }, site.as(admin))) as Blocks;
		}
		expect(JSON.stringify(screen.blocks)).toContain("Zebra crossing?");
	});
});
