// Must load before anything that starts the test host: it patches the sandbox bridge.
import { countBridgeCalls, MAX_BRIDGE_CALLS } from "./bridge-count";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { emptyPoll, pollOptionKey, voteRowId } from "../src/lib/polls";
import { POLLS, VOTES } from "../src/lib/types";
import { member, openSite } from "./site";

/**
 * Bridge calls per plugin call, at the worst realistic case of each entry point.
 *
 * On Cloudflare a sandboxed plugin call gets 10 subrequests and every bridge call is one, so an
 * entry over MAX_BRIDGE_CALLS (9) fails part way there. Every entry must stay at or under it, and
 * each test also pins the count measured on 0.5.0, so a rise shows here before it ships.
 *
 * One busy site is seeded once, the way 0.4.0 left it (no stored counts), and the tests run in
 * order. Each test sets up the state it needs right before it measures; fixture writes are not
 * counted. WB Polls registers no hooks and no cron, so every entry point is a route, an admin page
 * or action, or the editor panel.
 *
 * Measured on 0.4.0, for comparison: get 11 to 13, slot 13 to 21, vote_guest 13 to 38, vote 11 to
 * 37, ballot 21 and 22, mine GET 101, the admin list and every action that re-renders it 30 to 34,
 * results 17, erase 25, delete_confirm 45, editor panel load 13, panel remove 12.
 */
const MEASURED: Record<string, number> = {
	"route health": 1,
	"route get (id, 10 answers, 500 votes not counted yet)": 9,
	"route get (id, due to open, 10 answers)": 4,
	"route get (latest, newest expired, 10 answers, counting continues)": 8,
	"route slot (page poll, 10 answers)": 4,
	"route slot (site polls, 3 expired, closed one with 10 answers)": 6,
	"route vote_guest (2 answers, first guest, first vote)": 9,
	"route vote_guest (10 answers, same 10 again)": 7,
	"route vote_guest (10 answers, change 5 for the other 5)": 9,
	"route ballot_guest (10 answers)": 4,
	"route vote (10 answers, same 10 again)": 6,
	"route vote (10 answers, change 5 for the other 5)": 8,
	"route vote (2 answers, first vote)": 7,
	"route vote (rate limited)": 2,
	"route ballot (10 answers)": 3,
	"route mine GET (100 polls)": 2,
	"route mine DELETE (100 polls)": 5,
	"route mine DELETE (3 polls, counts kept exact)": 8,
	"admin page_load /polls": 9,
	"admin page_load /edit": 1,
	"admin widget open": 2,
	"admin form find (no match, 150+ polls)": 6,
	"admin block page (next)": 9,
	"admin table sort click": 7,
	"admin poll_mod edit (voted)": 4,
	"admin poll_mod results (500 votes, named)": 3,
	"admin poll_mod recount (500 votes, named)": 9,
	"admin poll_mod copy": 6,
	"admin form save (new, content type)": 8,
	"admin form save (voted, content type)": 9,
	"admin poll_mod open": 8,
	"admin poll_mod close": 8,
	"admin poll_mod delete (asks)": 6,
	"admin poll_mod stale stamp": 7,
	"admin poll_mod erase (500 votes, recount under way)": 9,
	"admin block kit_done": 7,
	"admin block kit_again": 7,
	"editor panel load (own poll)": 5,
	"editor panel load (no own poll, site polls expired)": 5,
	"editor panel attach": 7,
	"editor panel open": 7,
	"editor panel remove": 7,
	"editor panel create": 7,
	"admin delete_confirm (500 votes)": 9,
	"admin page_load /polls (deleted poll's votes removed)": 9,
};

/** Every entry over MAX_BRIDGE_CALLS. Empty since 0.5.0, and it stays empty. */
const KNOWN_OVER: Array<[string, number]> = [];

const GENERIC = 150;
const BIG_VOTERS = 250;
const HEAVY_POLLS = 100;
const TEN = Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, label: `Answer ${i}` }));
const TWO = TEN.slice(0, 2);
const FIRST_FIVE = TEN.slice(0, 5).map((o) => o.id);
const LAST_FIVE = TEN.slice(5).map((o) => o.id);
const PAST = "2026-01-02T00:00:00.000Z";

const fromIp = (ip: string, method = "POST") => ({ method, meta: { ip, userAgent: null, referer: null, geo: null } });
const as = (id: string, method = "POST") => ({ method, user: member(id) });

type Row = Record<string, unknown>;
let s: Awaited<ReturnType<typeof openSite>>;
let live = "";
let other = "";
const seen = new Map<string, number>();

let clock = Date.parse("2026-01-01T00:00:00.000Z");
const nextIso = () => new Date((clock += 60_000)).toISOString();

const poll = (overrides: Row = {}): Row => ({ ...emptyPoll(nextIso()), question: "Question?", options: TWO, status: "open", ...overrides });
const putPoll = (id: string, row: Row) => s.rt.fixtures.plugin.storage(POLLS, id, row);
const getPoll = async (id: string) => (await s.rt.inspect.storage.get<Row>(POLLS, id))!;
const putVote = (pollId: string, who: string, optionId: string, extra: Row = {}) =>
	s.rt.fixtures.plugin.storage(VOTES, voteRowId(pollId, who, optionId), {
		poll: pollId,
		poll_option: pollOptionKey(pollId, optionId),
		member_id: who,
		createdAt: nextIso(),
		visitor: "",
		member_name: who,
		...extra,
	});

async function measure<T>(name: string, run: () => Promise<T>): Promise<T> {
	const { result, calls } = await countBridgeCalls(run);
	seen.set(name, calls.length);
	expect.soft(calls.length, `${name} => ${calls.join(",")}`).toBeLessThanOrEqual(MAX_BRIDGE_CALLS);
	expect.soft(calls.length, `${name} => ${calls.join(",")}`).toBe(MEASURED[name]);
	return result;
}

const admin = (input: Row) => s.call("admin", { page: "/polls", ...input });
const mod = (action: string, row: Row, id: string, extra = "") =>
	admin({ type: "block_action", action_id: "poll_mod", value: [action, row.rev, id, ...(extra ? [extra] : [])].join("|") });

/** Three whole-site polls past their close time but still stored as open, and one closed whole-site poll. */
async function siteSlotState() {
	for (const n of [1, 2, 3]) await putPoll(`site_expired_${n}`, { ...(await getPoll(`site_expired_${n}`)), status: "open", closes_at: PAST });
}

beforeAll(async () => {
	s = await openSite();
	await s.rt.fixtures.collection({
		slug: "posts",
		label: "Posts",
		labelSingular: "Post",
		urlPattern: "/posts/{slug}",
		supports: ["drafts", "revisions"],
		fields: [{ slug: "title", label: "Title", type: "string", required: true }],
	} as never);
	live = (await s.rt.fixtures.content("posts", { data: { title: "Live" }, slug: "live", status: "published" } as never)).id;
	other = (await s.rt.fixtures.content("posts", { data: { title: "Other" }, slug: "other", status: "published" } as never)).id;
	// 150 ordinary polls, half open, none attached.
	for (let i = 0; i < GENERIC; i++) await putPoll(`p${String(i).padStart(3, "0")}`, poll({ question: `Poll ${i}?`, status: i % 2 ? "open" : "closed" }));
	// A member who voted in 100 of them.
	for (let i = 0; i < HEAVY_POLLS; i++) await putVote(`p${String(i).padStart(3, "0")}`, "heavy", "o0");
	// Whole-site polls: three expired but still stored as open, one closed with ten answers.
	for (const n of [1, 2, 3]) await putPoll(`site_expired_${n}`, poll({ question: `Site ${n}?`, attach: "site", closes_at: PAST }));
	await putPoll("site_closed", poll({ question: "Site closed?", attach: "site", status: "closed", options: TEN }));
	// A plain two-answer guest poll (the calibration case), older than the busiest poll.
	await putPoll("small", poll({ question: "Small?" }));
	// The busiest poll: ten answers, several allowed, named, change allowed, attached to the live post, 500 votes.
	await putPoll("big", poll({ question: "Big?", options: TEN, multiple: true, named: true, allow_change: true, attach: "entry", attach_key: `posts:${live}` }));
	for (let n = 0; n < BIG_VOTERS; n++) for (const o of ["o0", "o1"]) await putVote("big", `m${n}`, o);
	// The newest open poll, past its close time but still stored as open.
	await putPoll("latest_expired", poll({ question: "Latest?", closes_at: PAST }));
}, 600_000);

afterAll(async () => {
	await s?.dispose();
});

describe("public routes", () => {
	it("health", async () => {
		await measure("route health", () => s.call("health", {}, fromIp("198.51.100.7", "GET")));
	});

	it("get by id: ten answers, results always, 500 votes from 0.4.0 not counted yet", async () => {
		// The first read counts five answers and stores them; results wait until all ten are counted.
		const first = await measure("route get (id, 10 answers, 500 votes not counted yet)", () => s.call("get", { id: "big" }, { method: "GET" }));
		expect(first).toMatchObject({ ok: true, counting: true });
		expect(first).not.toHaveProperty("results");
	});

	it("get by id: a scheduled draft that is due to open, ten answers", async () => {
		await putPoll("scheduled", poll({ question: "Scheduled?", status: "draft", opens_at: PAST, options: TEN, createdAt: "2025-01-01T00:00:00.000Z" }));
		expect(await measure("route get (id, due to open, 10 answers)", () => s.call("get", { id: "scheduled" }, { method: "GET" }))).toMatchObject({
			ok: true,
		});
	});

	it("get latest: the newest open poll is past its close time", async () => {
		const result = await measure("route get (latest, newest expired, 10 answers, counting continues)", () =>
			s.call("get", { latest: true }, { method: "GET" }),
		);
		// The second read counts the other five answers: exact results.
		expect(result).toMatchObject({ ok: true, poll: { id: "big" }, results: { total: 2 * BIG_VOTERS } });
	});

	it("slot: page with its own open poll, ten answers", async () => {
		expect(await measure("route slot (page poll, 10 answers)", () => s.call("slot", { collection: "posts", id: live }, { method: "GET" }))).toMatchObject({
			poll: { id: "big" },
		});
	});

	it("slot: page with no poll of its own, whole-site polls expired, closed one has ten answers", async () => {
		await siteSlotState();
		const result = await measure("route slot (site polls, 3 expired, closed one with 10 answers)", () =>
			s.call("slot", { collection: "posts", id: other }, { method: "GET" }),
		);
		expect(result).toMatchObject({ poll: { id: "site_closed" } });
	});

	it("vote_guest: two answers, first vote, first guest on the site (calibration case)", async () => {
		expect(
			await measure("route vote_guest (2 answers, first guest, first vote)", () => s.call("vote_guest", { id: "small", choices: ["o0"] }, fromIp("203.0.113.5"))),
		).toMatchObject({ ok: true });
	});

	it("vote_guest: ten answers, the same ten again, then five swapped for the other five", async () => {
		await s.call("vote_guest", { id: "big", choices: TEN.map((o) => o.id) }, fromIp("203.0.113.9"));
		expect(
			await measure("route vote_guest (10 answers, same 10 again)", () =>
				s.call("vote_guest", { id: "big", choices: TEN.map((o) => o.id).reverse() }, fromIp("203.0.113.9")),
			),
		).toMatchObject({ ok: true });
		await s.call("vote_guest", { id: "big", choices: FIRST_FIVE }, fromIp("203.0.113.10"));
		const swapped = await measure("route vote_guest (10 answers, change 5 for the other 5)", () =>
			s.call("vote_guest", { id: "big", choices: LAST_FIVE }, fromIp("203.0.113.10")),
		);
		expect(swapped).toMatchObject({ ok: true, choices: LAST_FIVE, results: { total: 2 * BIG_VOTERS + 10 + 5 } });
	});

	it("ballot_guest: ten answers, voted", async () => {
		await measure("route ballot_guest (10 answers)", () => s.call("ballot_guest", { id: "big" }, fromIp("203.0.113.9", "GET")));
	});
});

describe("member routes", () => {
	it("vote: ten answers, the same ten again, then five swapped for the other five", async () => {
		await s.call("vote", { id: "big", choices: TEN.map((o) => o.id) }, as("ana"));
		expect(
			await measure("route vote (10 answers, same 10 again)", () => s.call("vote", { id: "big", choices: TEN.map((o) => o.id) }, as("ana"))),
		).toMatchObject({ ok: true });
		await s.call("vote", { id: "big", choices: FIRST_FIVE }, as("dee"));
		expect(await measure("route vote (10 answers, change 5 for the other 5)", () => s.call("vote", { id: "big", choices: LAST_FIVE }, as("dee")))).toMatchObject({
			ok: true,
			choices: LAST_FIVE,
		});
	});

	it("vote: two answers, first vote", async () => {
		expect(await measure("route vote (2 answers, first vote)", () => s.call("vote", { id: "small", choices: ["o1"] }, as("ben")))).toMatchObject({ ok: true });
	});

	it("vote: rate limit hit", async () => {
		// 0.5.0: one key per voter, `<lock time>|<hour start>|<votes this hour>`.
		await s.rt.fixtures.plugin.kv("vote:carl", `0|${Date.now()}|8`);
		expect(await measure("route vote (rate limited)", () => s.call("vote", { id: "small", choices: ["o1"] }, as("carl")))).toMatchObject({
			ok: false,
			error: { code: "RATE_LIMITED" },
		});
	});

	it("ballot: ten answers, voted", async () => {
		await measure("route ballot (10 answers)", () => s.call("ballot", { id: "big" }, as("ana", "GET")));
	});

	it("mine GET: votes in 100 polls", async () => {
		const result = await measure("route mine GET (100 polls)", () => s.call("mine", {}, as("heavy", "GET")));
		expect((result as { items: Row[] }).items).toHaveLength(HEAVY_POLLS);
	});

	it("mine DELETE: votes in 100 polls", async () => {
		expect(await measure("route mine DELETE (100 polls)", () => s.call("mine", {}, as("heavy", "DELETE")))).toMatchObject({ ok: true, erased: HEAVY_POLLS });
	});

	it("mine DELETE: votes in 3 polls take exactly their votes off the counts", async () => {
		for (const id of ["p101", "p103", "p105"]) {
			await s.call("get", { id }, { method: "GET" });
			await s.call("vote", { id, choices: ["o1"] }, as("few"));
		}
		expect(await measure("route mine DELETE (3 polls, counts kept exact)", () => s.call("mine", {}, as("few", "DELETE")))).toMatchObject({ ok: true, erased: 3 });
		expect(await s.call("get", { id: "p103" }, { method: "GET" })).toMatchObject({ results: { total: 0 } });
	});
});

describe("admin pages and widget", () => {
	it("page loads", async () => {
		await measure("admin page_load /polls", () => s.rt.admin.loadPage("/polls"));
		await measure("admin page_load /edit", () => s.rt.admin.loadPage("/edit"));
		await measure("admin widget open", () => s.rt.admin.loadWidget("open"));
	});
});

describe("admin actions", () => {
	it("find, paging and the table sort click", async () => {
		await measure("admin form find (no match, 150+ polls)", () => admin({ type: "form_submit", action_id: "find", values: { q: "zzz" } }));
		await measure("admin block page (next)", () => admin({ type: "block_action", action_id: "page", value: "before|2026-01-01T02:00:00.000Z|" }));
		await measure("admin table sort click", () => admin({ type: "block_action", action_id: "polls_page", value: { sort: { key: "votes", dir: "asc" } } }));
	});

	it("poll_mod edit, results (500 votes, named), copy", async () => {
		const big = await getPoll("big");
		await measure("admin poll_mod edit (voted)", () => mod("edit", big, "big"));
		await measure("admin poll_mod results (500 votes, named)", () => mod("results", big, "big"));
		await measure("admin poll_mod recount (500 votes, named)", () => mod("recount", big, "big"));
		await measure("admin poll_mod copy", () => mod("copy", big, "big"));
	});

	it("save a new poll and save one with votes", async () => {
		const answers = Object.fromEntries(TEN.map((o, i) => [`answer_${i + 1}`, o.label]));
		await measure("admin form save (new, content type)", () =>
			admin({ type: "form_submit", action_id: "save||", page: "/edit", values: { question: "New?", ...answers, attach: "collection", attach_key: "posts" } }),
		);
		const big = await getPoll("big");
		await measure("admin form save (voted, content type)", () =>
			admin({
				type: "form_submit",
				action_id: `save|${big.rev}|big`,
				page: "/edit",
				values: { question: "Big again?", ...answers, multiple: true, named: true, allow_change: true, attach: "collection", attach_key: "posts" },
			}),
		);
		await putPoll("big", { ...(await getPoll("big")), attach: "entry", attach_key: `posts:${live}` });
	});

	it("poll_mod open, close, delete (asks), stale stamp", async () => {
		await measure("admin poll_mod open", async () => mod("open", await getPoll("p000"), "p000"));
		await measure("admin poll_mod close", async () => mod("close", await getPoll("p000"), "p000"));
		await measure("admin poll_mod delete (asks)", async () => mod("delete", await getPoll("p000"), "p000"));
		await measure("admin poll_mod stale stamp", () => mod("open", { rev: "old" }, "p000"));
	});

	it("poll_mod erase one member's votes on the 500-vote poll", async () => {
		await measure("admin poll_mod erase (500 votes, recount under way)", async () => mod("erase", await getPoll("big"), "big", "m1"));
	});

	it("setup kit buttons", async () => {
		await measure("admin block kit_done", () => admin({ type: "block_action", action_id: "kit_done" }));
		await measure("admin block kit_again", () => admin({ type: "block_action", action_id: "kit_again" }));
	});
});

describe("editor panel", () => {
	it("load on a page with its own poll", async () => {
		await measure("editor panel load (own poll)", () => s.rt.admin.loadEditorPanel("poll", "posts", live));
	});

	it("load on a page with no poll, whole-site polls expired", async () => {
		await siteSlotState();
		await measure("editor panel load (no own poll, site polls expired)", () => s.rt.admin.loadEditorPanel("poll", "posts", other));
	});

	it("attach, open, remove, create", async () => {
		await putPoll("p001", { ...(await getPoll("p001")), status: "closed" });
		await measure("editor panel attach", () => s.rt.admin.submitEditorPanel("poll", "posts", other, "attach", { poll_id: "p001" }));
		await measure("editor panel open", () => s.rt.admin.actEditorPanel("poll", "posts", other, "open"));
		await measure("editor panel remove", () => s.rt.admin.actEditorPanel("poll", "posts", other, "remove"));
		const answers = Object.fromEntries(TEN.map((o, i) => [`answer_${i + 1}`, o.label]));
		await measure("editor panel create", () =>
			s.rt.admin.submitEditorPanel("poll", "posts", other, "create", { question: "Here?", ...answers, who: "anyone", position: "below", open_now: true }),
		);
	});
});

describe("delete a poll with 500 votes", () => {
	it("delete_confirm", async () => {
		await measure("admin delete_confirm (500 votes)", async () => {
			const big = await getPoll("big");
			return admin({ type: "block_action", action_id: "delete_confirm", value: `delete_confirm|${big.rev}|big` });
		});
		// Gone for visitors at once, then its rows go a hundred per list load.
		expect(await s.call("get", { id: "big" }, { method: "GET" })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
		const before = await s.rt.inspect.storage.list(VOTES);
		await measure("admin page_load /polls (deleted poll's votes removed)", () => s.rt.admin.loadPage("/polls"));
		expect((await s.rt.inspect.storage.list(VOTES)).length).toBe(before.length - 100);
	});
});

describe("budget", () => {
	it("lists every entry over the Cloudflare budget", () => {
		expect([...seen.keys()].sort()).toEqual(Object.keys(MEASURED).sort());
		const over = [...seen].filter(([, n]) => n > MAX_BRIDGE_CALLS);
		expect(Object.fromEntries(over)).toEqual(Object.fromEntries(KNOWN_OVER));
	});
});
