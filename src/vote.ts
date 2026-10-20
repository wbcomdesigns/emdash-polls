import type { PluginContext } from "emdash/plugin";

import { MAX_CALLS, RATE_LIMITED, SIGN_IN, rateLimited, type Member } from "./core";
import {
	NOT_FOUND,
	effectiveStatus,
	getPoll,
	guestSeesResults,
	optionOf,
	parsePoll,
	parseVote,
	pollOptionKey,
	publicPoll,
	readResults,
	visitorWho,
	voteRowId,
	type PollRow,
} from "./lib/polls";
import { applyVoteDelta, resultsOf, type Results } from "./lib/tally";
import { DELETING, POLLS, TALLIES, VOTES } from "./lib/types";
import { requestAddress, visitorHash } from "./lib/visitor";
import { asRecord, asString, asStringArray, nowIso } from "./util";

type Ctx = PluginContext;
type RouteCtx = { input: unknown; user?: Member; requestMeta?: unknown; request?: { method?: string } };

const NOT_OPEN = { ok: false as const, error: { code: "NOT_OPEN" } };
const INVALID_CHOICE = { ok: false as const, error: { code: "INVALID_CHOICE" } };
const ALREADY_VOTED = { ok: false as const, error: { code: "ALREADY_VOTED" } };
const MEMBERS_ONLY = { ok: false as const, error: { code: "MEMBERS_ONLY" } };
const SPAM = { ok: false as const, error: { code: "SPAM" } };
// No visitor address from the host: guests are members only here (owner decision 2026-10-16).
// The code is MEMBERS_ONLY because the released 0.3.0 kit already shows it as a sign-in prompt;
// the 0.4.0 kit reads `reason` for its own wording.
export const GUEST_UNAVAILABLE = {
	ok: false as const,
	error: { code: "MEMBERS_ONLY", reason: "GUEST_UNAVAILABLE" },
};
const BUSY = { ok: false as const, error: { code: "BUSY" } };
const LOCK_MS = 30_000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;

function memberOf(routeCtx: RouteCtx): Member | null {
	const user = routeCtx.user;
	return user?.id ? user : null;
}

/** One call. A draft (not due to open) and a deleted poll are not found; status comes from the dates. */
async function loadForMember(ctx: Ctx, id: string): Promise<PollRow | typeof NOT_FOUND> {
	const found = await getPoll(ctx, id);
	if (!found || effectiveStatus(found) === "draft") return NOT_FOUND;
	return found;
}

/** The answers this voter has stored on this poll. One call. */
async function ownChoices(ctx: Ctx, poll: PollRow, who: string): Promise<string[]> {
	const found = await ctx.storage[VOTES].getMany(poll.options.map((option) => voteRowId(poll.id, who, option.id)));
	return poll.options.filter((option) => found.has(voteRowId(poll.id, who, option.id))).map((option) => option.id);
}

function seesResults(poll: PollRow, status: ReturnType<typeof effectiveStatus>, voted: boolean): boolean {
	if (guestSeesResults(poll, status)) return true;
	return poll.results === "after_vote" && voted;
}

type Reply = {
	ok: true;
	poll: ReturnType<typeof publicPoll>;
	choices: string[];
	thanks?: string;
	results?: Results;
	counting?: true;
};

/** The ballot answer. `counts` is what the caller already has (a vote's own write returns it); `used` is calls made so far. */
async function reply(ctx: Ctx, poll: PollRow, choices: string[], used: number, counts?: Results | null): Promise<Reply> {
	const status = effectiveStatus(poll);
	const voted = choices.length > 0;
	const body: Reply = { ok: true, poll: publicPoll(poll, status), choices };
	if (poll.thanks && voted) body.thanks = poll.thanks;
	if (!seesResults(poll, status, voted)) return body;
	if (counts !== undefined) {
		// After a vote the budget is spent: no counts yet means a poll from 0.4.0 still being counted.
		if (counts) body.results = counts;
		else body.counting = true;
		return body;
	}
	return { ...body, ...(await readResults(ctx, poll, used)) };
}

export async function handleBallot(routeCtx: RouteCtx, ctx: Ctx) {
	const user = memberOf(routeCtx);
	if (!user) return SIGN_IN;
	const loaded = await loadForMember(ctx, asString(asRecord(routeCtx.input).id));
	if ("error" in loaded) return loaded;
	return withCounts(ctx, loaded, await ownChoices(ctx, loaded, user.id), 2);
}

/** A ballot read also builds the counts of a poll from 0.4.0, so the vote that follows can update them. */
async function withCounts(ctx: Ctx, poll: PollRow, choices: string[], used: number): Promise<Reply> {
	const body = await reply(ctx, poll, choices, used);
	if (body.results || body.counting) return body;
	await readResults(ctx, poll, used);
	return body;
}

export async function handleVote(routeCtx: RouteCtx, ctx: Ctx) {
	const user = memberOf(routeCtx);
	if (!user) return SIGN_IN;

	const raw = asRecord(routeCtx.input);
	const loaded = await loadForMember(ctx, asString(raw.id));
	if ("error" in loaded) return loaded;
	if (effectiveStatus(loaded) !== "open") return NOT_OPEN;
	const choices = validChoices(loaded, raw.choices);
	if (!choices) return INVALID_CHOICE;

	return saveChoices(ctx, loaded, {
		who: user.id,
		memberId: user.id,
		visitor: "",
		name: loaded.named ? user.name || "" : "",
		choices,
		calls: 1,
	});
}

/** The choices sent, or null when one is not an answer of this poll or a one-choice poll got several. */
function validChoices(poll: PollRow, input: unknown): string[] | null {
	// A refused vote (NOT_OPEN, INVALID_CHOICE, MEMBERS_ONLY) writes nothing, so it is not counted
	// toward the hourly limit: the limit guards writes, and is counted under the ballot lock.
	const allowed = new Set(poll.options.map((option) => option.id));
	const choices = [...new Set(asStringArray(input))];
	if (!choices.length || choices.some((id) => !allowed.has(id))) return null;
	if (!poll.multiple && choices.length !== 1) return null;
	return choices;
}

export async function handleBallotGuest(routeCtx: RouteCtx, ctx: Ctx) {
	const raw = asRecord(routeCtx.input);
	const loaded = await loadForMember(ctx, asString(raw.id));
	if ("error" in loaded) return loaded;
	// The salt is read only when a guest can vote here.
	const who = loaded.who === "members" ? null : await guestWho(ctx, routeCtx);
	if (!who) return { ok: true, poll: publicPoll(loaded, effectiveStatus(loaded)), choices: [] as string[] };
	return withCounts(ctx, loaded, await ownChoices(ctx, loaded, who.who), who.calls + 2);
}

export async function handleVoteGuest(routeCtx: RouteCtx, ctx: Ctx) {
	const raw = asRecord(routeCtx.input);
	if (asString(raw.website) || asString(raw.honeypot)) return SPAM;
	if (!requestAddress(routeCtx)) return GUEST_UNAVAILABLE;

	const loaded = await loadForMember(ctx, asString(raw.id));
	if ("error" in loaded) return loaded;
	if (loaded.who === "members") return MEMBERS_ONLY;
	if (effectiveStatus(loaded) !== "open") return NOT_OPEN;
	const choices = validChoices(loaded, raw.choices);
	if (!choices) return INVALID_CHOICE;

	const who = await guestWho(ctx, routeCtx);
	if (!who) return GUEST_UNAVAILABLE;
	return saveChoices(ctx, loaded, {
		who: who.who,
		memberId: "",
		visitor: who.hash,
		name: "",
		choices,
		calls: 1 + who.calls,
	});
}

/** One guest per host-given address. A browser-sent visitor id is never trusted. */
async function guestWho(ctx: Ctx, routeCtx: RouteCtx) {
	const address = requestAddress(routeCtx);
	if (!address) return null;
	const hashed = await visitorHash(ctx, address);
	return hashed ? { who: visitorWho(hashed.hash), hash: hashed.hash, calls: hashed.calls } : null;
}

/**
 * One key per voter, `vote:<who>`, holding `<lockedAt>|<hour start>|<votes this hour>`. One
 * compare-and-set takes the lock and counts the vote toward the hourly limit, so votes sent together
 * take turns (the loser gets BUSY) and a BUSY answer to a double click does not use up the hour.
 * A lock older than LOCK_MS is left over from a request that died, and is taken over.
 */
async function withVoteLock<T>(ctx: Ctx, who: string, run: () => Promise<T>): Promise<T | typeof BUSY | typeof RATE_LIMITED> {
	const key = `vote:${who}`;
	const seen = await ctx.kv.getVersioned<string>(key);
	const [lockedAt = 0, start = 0, count = 0] = (seen?.value || "0|0|0").split("|").map(Number);
	const now = Date.now();
	if (now - lockedAt < LOCK_MS) return BUSY;
	const fresh = now - start > RATE_WINDOW_MS;
	if (!fresh && count >= RATE_MAX) return RATE_LIMITED;
	const hour = fresh ? `${now}|1` : `${start}|${count + 1}`;
	const claimed = await ctx.kv.compareAndSet(key, seen?.revision ?? null, `${now}|${hour}`);
	if (!claimed.applied) return BUSY;
	try {
		return await run();
	} finally {
		// Release keeps the hourly count. It cannot fail the answer: the vote is already stored.
		await ctx.kv.compareAndSet(key, claimed.revision, `0|${hour}`).catch(() => undefined);
	}
}

/** `calls`: bridge calls made before the lock (the poll read, and for a guest the salt). */
type Ballot = { who: string; memberId: string; visitor: string; name: string; choices: string[]; calls: number };

function saveChoices(ctx: Ctx, poll: PollRow, opts: Ballot) {
	return withVoteLock(ctx, opts.who, () => writeChoices(ctx, poll, opts));
}

/**
 * Under the lock: read the voter's stored answers (the read the write depends on), remove the ones
 * dropped, add the new ones, then update the counts in the same step. Unchanged answers keep their row.
 */
async function writeChoices(ctx: Ctx, poll: PollRow, opts: Ballot): Promise<Reply | typeof ALREADY_VOTED> {
	const previous = await ownChoices(ctx, poll, opts.who);
	if (previous.length && !poll.allow_change) return ALREADY_VOTED;
	const removed = previous.filter((id) => !opts.choices.includes(id));
	const added = opts.choices.filter((id) => !previous.includes(id));
	// Same answers again: nothing to write. Calls so far: before the lock, the lock, this read, and the release still to come.
	if (!removed.length && !added.length) return reply(ctx, poll, opts.choices, opts.calls + 4);

	const now = nowIso();
	const done: { removed: string[]; added: string[] } = { removed: [], added: [] };
	let counts: Results | null = null;
	try {
		if (removed.length) {
			await ctx.storage[VOTES].deleteMany(removed.map((id) => voteRowId(poll.id, opts.who, id)));
			done.removed = removed;
		}
		if (added.length) {
			await ctx.storage[VOTES].putMany(
				added.map((optionId) => ({
					id: voteRowId(poll.id, opts.who, optionId),
					data: {
						poll: poll.id,
						poll_option: pollOptionKey(poll.id, optionId),
						member_id: opts.memberId,
						createdAt: now,
						visitor: opts.visitor,
						member_name: opts.name,
					},
				})),
			);
			done.added = added;
		}
	} finally {
		// Counts follow whatever rows were really written, even when a write failed part way.
		if (done.removed.length || done.added.length) counts = resultsOf(poll, await applyVoteDelta(ctx, poll, done.added, done.removed));
	}
	return reply(ctx, poll, opts.choices, MAX_CALLS, counts);
}

export async function handleMine(routeCtx: RouteCtx, ctx: Ctx) {
	const user = memberOf(routeCtx);
	if (!user) return SIGN_IN;
	const method = asString(routeCtx.request?.method) || "GET";
	return method === "DELETE" ? eraseMine(ctx, user.id) : listMine(ctx, user.id);
}

/** Pages of 100 vote rows `mine` GET reads: with one read of the polls, 9 calls. */
const MINE_PAGES = 8;

async function listMine(ctx: Ctx, memberId: string) {
	const byPoll = new Map<string, string[]>();
	let cursor: string | undefined;
	for (let page = 0; page < MINE_PAGES; page += 1) {
		const found = await ctx.storage[VOTES].query({ where: { member_id: memberId }, orderBy: { createdAt: "desc" }, limit: 100, cursor });
		for (const item of found.items) {
			const vote = parseVote(item.data);
			byPoll.set(vote.poll, [...(byPoll.get(vote.poll) ?? []), optionOf(vote)]);
		}
		if (!found.hasMore || !found.cursor) break;
		cursor = found.cursor;
	}
	if (!byPoll.size) return { ok: true as const, items: [] };
	const polls = await ctx.storage[POLLS].getMany([...byPoll.keys()]);
	const items = [];
	for (const [pollId, optionIds] of byPoll) {
		const data = polls.get(pollId);
		if (!data || asRecord(data).status === DELETING) continue;
		const poll = parsePoll(data);
		const unique = [...new Set(optionIds)];
		items.push({
			id: pollId,
			question: poll.question,
			status: effectiveStatus(poll),
			labels: unique.map((id) => poll.options.find((option) => option.id === id)?.label ?? "").filter(Boolean),
		});
	}
	return { ok: true as const, items };
}

/** Pages of 100 rows one erase call removes. More than that answers BUSY with reason MORE, and the kit calls again. */
const ERASE_PAGES = 3;

async function eraseMine(ctx: Ctx, memberId: string) {
	if (await rateLimited(ctx, `erase:${memberId}`)) return RATE_LIMITED;
	let erased = 0;
	let pages = 0;
	let more = false;
	const touched = new Map<string, { added: string[]; removed: string[] }>();
	for (let page = 0; page < ERASE_PAGES; page += 1) {
		// Rows are deleted as they are read, so each query starts again from the first remaining row.
		const found = await ctx.storage[VOTES].query({ where: { member_id: memberId }, limit: 100 });
		pages += 1;
		if (!found.items.length) break;
		await ctx.storage[VOTES].deleteMany(found.items.map((item) => item.id));
		erased += found.items.length;
		for (const item of found.items) {
			const vote = parseVote(item.data);
			const change = touched.get(vote.poll) ?? { added: [], removed: [] };
			change.removed.push(optionOf(vote));
			touched.set(vote.poll, change);
		}
		more = found.hasMore;
		if (!more) break;
	}
	// Calls left: the budget less the hourly limit (2) and a query and a delete per page.
	await dropCounts(ctx, touched, MAX_CALLS - 2 - 2 * pages);
	if (more) return { ok: false as const, erased, error: { code: "BUSY", reason: "MORE" } };
	return { ok: true as const, erased };
}

/**
 * Take erased votes off the counts: exactly, one write per poll, when the budget allows; otherwise
 * remove those polls' count records in one write, and the next read counts them again from the rows.
 * Never fails the answer: the votes are already gone.
 */
async function dropCounts(ctx: Ctx, touched: Map<string, { added: string[]; removed: string[] }>, calls: number) {
	if (!touched.size) return;
	if (touched.size <= calls - 1) {
		const polls = await ctx.storage[POLLS].getMany([...touched.keys()]).catch(() => null);
		if (polls) {
			for (const [id, change] of touched) {
				const data = polls.get(id);
				if (data) await applyVoteDelta(ctx, { id, options: parsePoll(data).options }, [], change.removed);
			}
			return;
		}
	}
	await ctx.storage[TALLIES].deleteMany([...touched.keys()]).catch(() => undefined);
}
