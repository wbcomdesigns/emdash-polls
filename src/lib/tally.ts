import type { PluginContext } from "emdash/plugin";

import { asRecord } from "../util";
import { TALLIES, VOTES, type Poll } from "./types";

/**
 * Stored vote counts, one record per poll in `tallies` (id = poll id). Vote rows stay the source
 * of truth; this record only lets a page show results in one read instead of one count per answer.
 *
 * Fields: `a0`..`a9` are the counts of the poll's answers by position (answers cannot be added,
 * removed or reordered once a poll has votes, so positions are stable while counts are not zero).
 * `seq` goes up with every change a vote makes, so a rebuild step that raced a vote is not stored.
 * `step` is the next answer a stepped rebuild counts, and `ready` says every answer is counted.
 *
 * Polls from 0.4.0 have no record. The first read builds it: one query when the poll has up to
 * 100 vote rows, otherwise a few answers per call (`count` per answer) until it is ready. Until
 * then a reader gets no numbers and `counting: true`, never a partial total.
 */
export type Tally = Record<string, number | boolean | string> & { poll: string; seq: number; step: number; ready: boolean };

export type Results = {
	total: number;
	options: Array<{ id: string; label: string; count: number; percent: number }>;
};

type Ctx = Pick<PluginContext, "storage">;

const field = (index: number) => `a${index}`;

export function zeroTally(poll: Pick<Poll, "options"> & { id: string }): Tally {
	const row: Tally = { poll: poll.id, seq: 0, step: poll.options.length, ready: true };
	poll.options.forEach((_, i) => (row[field(i)] = 0));
	return row;
}

export function parseTally(data: unknown): Tally | null {
	const raw = asRecord(data);
	if (typeof raw.poll !== "string") return null;
	return { ...(raw as Tally), seq: Number(raw.seq) || 0, step: Number(raw.step) || 0, ready: raw.ready === true };
}

export function resultsOf(poll: Pick<Poll, "options">, tally: Tally | null): Results | null {
	if (!tally?.ready) return null;
	const counts = poll.options.map((option, i) => ({ id: option.id, label: option.label, count: Math.max(0, Number(tally[field(i)]) || 0) }));
	const total = counts.reduce((sum, row) => sum + row.count, 0);
	return { total, options: counts.map((row) => ({ ...row, percent: total ? Math.round((row.count / total) * 100) : 0 })) };
}

/** Total votes for a list column, or null while the poll is not counted yet. */
export function totalOf(poll: Pick<Poll, "options">, tally: Tally | null): number | null {
	return resultsOf(poll, tally)?.total ?? null;
}

export async function getTally(ctx: Ctx, pollId: string): Promise<Tally | null> {
	return parseTally(await ctx.storage[TALLIES].get(pollId));
}

/** Counts per answer position from vote rows. Rows of an answer the poll no longer has are ignored. */
function countRows(poll: Pick<Poll, "options"> & { id: string }, rows: Array<{ data: unknown }>): Tally {
	const row = zeroTally(poll);
	const index = new Map(poll.options.map((option, i) => [`${poll.id}:${option.id}`, i]));
	for (const item of rows) {
		const i = index.get(String(asRecord(item.data).poll_option));
		if (i !== undefined) row[field(i)] = (row[field(i)] as number) + 1;
	}
	return row;
}

/**
 * Make the poll's counts ready, using at most `calls` bridge calls. Returns the ready record, or
 * the record as far as it got (not ready), or null when nothing could be done.
 *
 * ponytail: a vote whose rows land between a rebuild's count and its store can be counted twice
 * or missed (one bridge call wide; `seq` stops the wider case). The owner's Recount fixes it.
 */
export async function ensureTally(ctx: Ctx, poll: Pick<Poll, "options"> & { id: string }, row: Tally | null, calls: number): Promise<Tally | null> {
	if (row?.ready) return row;
	const n = poll.options.length;
	if (!row) {
		if (calls < 2) return null;
		const found = await ctx.storage[VOTES].query({ where: { poll: poll.id }, limit: 100 });
		let next: Tally;
		if (!found.hasMore) next = countRows(poll, found.items);
		else {
			const upto = Math.min(n, calls - 2);
			if (upto < 1) return null;
			next = { ...zeroTally(poll), step: upto, ready: upto >= n };
			for (let i = 0; i < upto; i += 1) next[field(i)] = await countAnswer(ctx, poll, i);
		}
		// A reader that lost the race to create it still shows what it counted.
		await ctx.storage[TALLIES].compareAndSet(poll.id, null, next);
		return next;
	}
	const upto = Math.min(n, row.step + calls - 1);
	if (upto <= row.step) return row;
	const set: Record<string, number | boolean> = { step: upto, ready: upto >= n };
	for (let i = row.step; i < upto; i += 1) set[field(i)] = await countAnswer(ctx, poll, i);
	const done = await ctx.storage[TALLIES].updateIf(poll.id, { where: { seq: row.seq, step: row.step }, set });
	return done.applied ? parseTally(done.data) : row;
}

async function countAnswer(ctx: Ctx, poll: Pick<Poll, "options"> & { id: string }, i: number): Promise<number> {
	return ctx.storage[VOTES].count({ poll_option: `${poll.id}:${poll.options[i]!.id}` });
}

/**
 * Apply a voter's change in one guarded write: +1 for each added answer, -1 for each removed one.
 * Returns the stored record after the change, or null when the poll has no record yet (it is built
 * from the vote rows later) or the write failed. Never throws: the votes are already stored.
 */
export async function applyVoteDelta(
	ctx: Ctx,
	poll: Pick<Poll, "options"> & { id: string },
	added: string[],
	removed: string[],
): Promise<Tally | null> {
	const delta: Record<string, { inc: number } | { dec: number }> = { seq: { inc: 1 } };
	poll.options.forEach((option, i) => {
		const change = (added.includes(option.id) ? 1 : 0) - (removed.includes(option.id) ? 1 : 0);
		if (change > 0) delta[field(i)] = { inc: change };
		if (change < 0) delta[field(i)] = { dec: -change };
	});
	const done = await ctx.storage[TALLIES].updateIf(poll.id, { where: {}, delta }).catch(() => ({ applied: false as const }));
	return done.applied ? parseTally(done.data) : null;
}

/** Start a recount: keep the record (votes keep updating it), count every answer again. */
export async function restartTally(ctx: Ctx, pollId: string): Promise<Tally | null> {
	const done = await ctx.storage[TALLIES].updateIf(pollId, { where: {}, set: { step: 0, ready: false }, delta: { seq: { inc: 1 } } });
	return done.applied ? parseTally(done.data) : null;
}

/**
 * Admin list migration: one query of the vote rows of the listed polls that have no record, ordered
 * by poll, then one write of a record for every poll that query covered completely.
 */
export async function buildMissing(ctx: Ctx, polls: Array<Pick<Poll, "options"> & { id: string }>): Promise<Map<string, Tally>> {
	const built = new Map<string, Tally>();
	if (!polls.length) return built;
	const found = await ctx.storage[VOTES].query({
		where: { poll: { in: polls.map((poll) => poll.id) } },
		orderBy: { poll: "asc" },
		limit: 100,
	});
	const byPoll = new Map<string, Array<{ data: unknown }>>();
	for (const item of found.items) {
		const id = String(asRecord(item.data).poll);
		byPoll.set(id, [...(byPoll.get(id) ?? []), item]);
	}
	// Rows come in poll order, so with more to read only polls before the last one seen are complete.
	const last = found.hasMore ? String(asRecord(found.items[found.items.length - 1]?.data).poll) : null;
	for (const poll of polls) {
		if (last !== null && poll.id >= last) continue;
		built.set(poll.id, countRows(poll, byPoll.get(poll.id) ?? []));
	}
	// ponytail: a record another call created between the read and this write is replaced by the same rows' count.
	if (built.size) await ctx.storage[TALLIES].putMany([...built].map(([id, data]) => ({ id, data })));
	return built;
}
