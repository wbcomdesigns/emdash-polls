import type { PluginContext } from "emdash/plugin";

import { asBoolean, asRecord, asString, nowIso } from "../util";
import {
	ATTACH,
	NUMBERS,
	OPTIONS_MAX,
	OPTIONS_MIN,
	POLLS,
	POSITIONS,
	QUESTION_MAX,
	RESULTS,
	STATUSES,
	THANKS_MAX,
	VOTES,
	WHO,
	type Poll,
	type PollOption,
	type PollStatus,
	type Vote,
} from "./types";

export { POLLS, VOTES } from "./types";

type Ctx = Pick<PluginContext, "storage">;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	const text = asString(value);
	return (allowed as readonly string[]).includes(text) ? (text as T) : fallback;
}

export function newId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function newRev(): string {
	return crypto.randomUUID();
}

export function pollOptionKey(pollId: string, optionId: string): string {
	return `${pollId}:${optionId}`;
}

export function voteRowId(pollId: string, who: string, optionId: string): string {
	return `${pollId}:${who}:${optionId}`;
}

export function visitorWho(visitorHash: string): string {
	return `v-${visitorHash}`;
}

export function emptyPoll(now = nowIso()): Poll {
	return {
		question: "",
		options: [],
		multiple: false,
		allow_change: false,
		results: "always",
		status: "draft",
		closes_at: "",
		thanks: "",
		opens_at: "",
		position: "below",
		numbers: "full",
		createdAt: now,
		who: "anyone",
		named: false,
		attach: "none",
		attach_key: "",
		rev: newRev(),
	};
}

export function parseOptions(value: unknown): PollOption[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const options: PollOption[] = [];
	for (const item of value) {
		const raw = asRecord(item);
		const label = asString(raw.label).slice(0, QUESTION_MAX);
		if (!label) continue;
		let id = asString(raw.id).replace(/[^a-zA-Z0-9_-]/g, "");
		if (!id || seen.has(id)) id = newId("o");
		seen.add(id);
		options.push({ id, label });
		if (options.length >= OPTIONS_MAX) break;
	}
	return options;
}

export function parsePoll(input: unknown, fallback: Partial<Poll> = {}): Poll {
	const raw = asRecord(input);
	const base = emptyPoll(asString(fallback.createdAt) || asString(raw.createdAt) || nowIso());
	return {
		question: asString(raw.question || fallback.question).slice(0, QUESTION_MAX),
		options: parseOptions(raw.options ?? fallback.options),
		multiple: asBoolean(raw.multiple ?? fallback.multiple),
		allow_change: asBoolean(raw.allow_change ?? fallback.allow_change),
		results: oneOf(raw.results ?? fallback.results, RESULTS, "always"),
		status: oneOf(raw.status ?? fallback.status, STATUSES, "draft"),
		closes_at: asString(raw.closes_at ?? fallback.closes_at),
		thanks: asString(raw.thanks ?? fallback.thanks).slice(0, THANKS_MAX),
		opens_at: asString(raw.opens_at ?? fallback.opens_at),
		position: oneOf(raw.position ?? fallback.position, POSITIONS, "below"),
		numbers: oneOf(raw.numbers ?? fallback.numbers, NUMBERS, "full"),
		createdAt: asString(raw.createdAt || fallback.createdAt) || base.createdAt,
		who: oneOf(raw.who ?? fallback.who, WHO, "anyone"),
		named: asBoolean(raw.named ?? fallback.named),
		attach: oneOf(raw.attach ?? fallback.attach, ATTACH, "none"),
		attach_key: asString(raw.attach_key ?? fallback.attach_key),
		rev: asString(raw.rev || fallback.rev) || newRev(),
	};
}

export function parseVote(input: unknown): Vote {
	const raw = asRecord(input);
	return {
		poll: asString(raw.poll),
		poll_option: asString(raw.poll_option),
		member_id: asString(raw.member_id),
		createdAt: asString(raw.createdAt) || nowIso(),
		visitor: asString(raw.visitor),
		member_name: asString(raw.member_name),
	};
}

/** Status the visitor should see right now. Close and open times apply on read. */
export function effectiveStatus(poll: Poll, now = Date.now()): PollStatus {
	if (poll.status === "closed") return "closed";
	if (poll.closes_at && Date.parse(poll.closes_at) <= now) return "closed";
	if (poll.status === "draft") {
		if (poll.opens_at && Date.parse(poll.opens_at) <= now) return "open";
		return "draft";
	}
	return "open";
}

export function optionLabelsOk(options: PollOption[]): string | null {
	if (options.length < OPTIONS_MIN) return "Add at least two answers.";
	if (options.length > OPTIONS_MAX) return "A poll can have at most ten answers.";
	if (options.some((option) => !option.label)) return "Every answer needs text.";
	return null;
}

export async function countOpenPolls(ctx: Ctx): Promise<number> {
	return ctx.storage[POLLS].count({ status: "open" });
}

export async function applySchedule(ctx: Ctx, poll: PollRow): Promise<PollRow> {
	const status = effectiveStatus(poll);
	if (status === poll.status) return poll;
	const rev = newRev();
	const applied = await ctx.storage[POLLS].updateIf(poll.id, {
		where: { rev: poll.rev },
		set: { status, rev },
	});
	if (!applied.applied) return (await getPoll(ctx, poll.id)) ?? { ...poll, status };
	return { ...poll, status, rev };
}

export function guestSeesResults(poll: Poll, status: PollStatus): boolean {
	// Once voting has ended nobody can vote any more, so "after voting" would hide results for good.
	if (poll.results === "always" || status === "closed") return true;
	return false;
}

export async function tally(ctx: Ctx, poll: PollRow): Promise<{
	total: number;
	options: Array<{ id: string; label: string; count: number; percent: number }>;
}> {
	const counts = await Promise.all(
		poll.options.map(async (option) => ({
			id: option.id,
			label: option.label,
			count: await ctx.storage[VOTES].count({ poll_option: pollOptionKey(poll.id, option.id) }),
		})),
	);
	const total = counts.reduce((sum, row) => sum + row.count, 0);
	return {
		total,
		options: counts.map((row) => ({
			...row,
			percent: total ? Math.round((row.count / total) * 100) : 0,
		})),
	};
}

export function publicPoll(poll: PollRow, status: PollStatus) {
	return {
		id: poll.id,
		question: poll.question,
		options: poll.options.map((option) => ({ id: option.id, label: option.label })),
		multiple: poll.multiple,
		allow_change: poll.allow_change,
		status,
		closes_at: poll.closes_at,
		who: poll.who,
		named: poll.named,
		results: poll.results,
		numbers: poll.numbers,
		position: poll.position,
	};
}

export const NOT_FOUND = { ok: false as const, error: { code: "NOT_FOUND" } };

async function latestOpen(ctx: Ctx): Promise<PollRow | null> {
	const found = await ctx.storage[POLLS].query({
		where: { status: "open" },
		orderBy: { createdAt: "desc" },
		limit: 1,
	});
	const first = found.items[0];
	return first ? { id: first.id, ...parsePoll(first.data) } : null;
}

export async function readPublicPoll(
	ctx: Ctx,
	input: unknown,
): Promise<
	| typeof NOT_FOUND
	| { ok: true; poll: ReturnType<typeof publicPoll>; results?: Awaited<ReturnType<typeof tally>> }
> {
	const raw = asRecord(input);
	let row: PollRow | null = null;
	if (asBoolean(raw.latest)) {
		row = await latestOpen(ctx);
		if (row) row = await applySchedule(ctx, row);
		if (!row || effectiveStatus(row) !== "open") {
			row = await latestOpen(ctx);
			if (row) row = await applySchedule(ctx, row);
		}
		if (!row || effectiveStatus(row) !== "open") return NOT_FOUND;
	} else {
		row = await getPoll(ctx, asString(raw.id));
		if (!row) return NOT_FOUND;
		if (row.status === "draft" && effectiveStatus(row) !== "open") return NOT_FOUND;
		row = await applySchedule(ctx, row);
		if (effectiveStatus(row) === "draft") return NOT_FOUND;
	}
	const status = effectiveStatus(row);
	const poll = publicPoll(row, status);
	if (!guestSeesResults(row, status)) return { ok: true, poll };
	return { ok: true, poll, results: await tally(ctx, row) };
}

export async function getPoll(ctx: Ctx, id: string): Promise<(Poll & { id: string }) | null> {
	if (!id) return null;
	const data = await ctx.storage[POLLS].get(id);
	if (!data) return null;
	return { id, ...parsePoll(data) };
}

export async function putPoll(ctx: Ctx, id: string, poll: Poll): Promise<void> {
	await ctx.storage[POLLS].put(id, poll);
}

export async function getVote(ctx: Ctx, id: string): Promise<(Vote & { id: string }) | null> {
	if (!id) return null;
	const data = await ctx.storage[VOTES].get(id);
	if (!data) return null;
	return { id, ...parseVote(data) };
}

/**
 * One text field per answer. EmDash's multiline field is about two lines tall and cannot be
 * resized from Block Kit, so a list of answers clipped inside it. Answers 1 and 2 always show;
 * each later one appears once the one before it has text. A poll with votes shows exactly its
 * answers, because answers cannot be added then.
 */
export function answerFields(labels: string[], locked: boolean) {
	const count = locked ? labels.length : OPTIONS_MAX;
	return Array.from({ length: count }, (_, index) => ({
		type: "text_input" as const,
		action_id: `answer_${index + 1}`,
		label: `Answer ${index + 1}`,
		initial_value: labels[index] ?? "",
		...(index >= OPTIONS_MIN && !locked ? { condition: { field: `answer_${index}`, neq: "" } } : {}),
	}));
}

/**
 * The answers a form sent, in field order. On a poll with votes (lockedCount) every answer field
 * shows, so all of them are read as they are, empty ones included, and the save can say which
 * needs text. Otherwise a field counts only when the form showed it (the rule in answerFields),
 * so text left in a field that was hidden again is not saved, and empty fields are dropped.
 */
export function answersFromForm(values: Record<string, unknown>, lockedCount = 0): string[] {
	const raw = Array.from({ length: OPTIONS_MAX }, (_, index) => asString(values[`answer_${index + 1}`]).trim());
	if (lockedCount) return raw.slice(0, lockedCount);
	return raw.filter((text, index) => text && (index < OPTIONS_MIN || raw[index - 1]));
}

export function applyOptionEdits(
	previous: PollOption[],
	answers: string[],
	locked: boolean,
): { ok: true; options: PollOption[] } | { ok: false; error: string } {
	const trimmed = answers.map((answer) => answer.trim().slice(0, QUESTION_MAX));
	const labels = locked ? trimmed : trimmed.filter(Boolean);
	if (locked) {
		if (labels.length !== previous.length) {
			return { ok: false, error: "This poll has votes, so answers cannot be added or removed." };
		}
		if (labels.some((label) => !label)) {
			return { ok: false, error: "Every answer needs text." };
		}
		return {
			ok: true,
			options: previous.map((option, index) => ({ id: option.id, label: labels[index] ?? option.label })),
		};
	}
	const options = labels.slice(0, OPTIONS_MAX).map((label, index) => ({
		id: previous[index]?.id || newId("o"),
		label,
	}));
	const error = optionLabelsOk(options);
	if (error) return { ok: false, error };
	return { ok: true, options };
}

export function parseTimeField(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
	const text = asString(value);
	if (!text) return { ok: true, value: "" };
	const ms = Date.parse(text);
	if (Number.isNaN(ms)) return { ok: false, error: "Use a real date and time, or leave the field empty." };
	return { ok: true, value: new Date(ms).toISOString() };
}

/** Times of day offered next to the date picker, every 30 minutes. */
export const TIME_OPTIONS: Array<{ label: string; value: string }> = Array.from({ length: 48 }, (_, i) => {
	const value = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
	return { label: value, value };
});

/** The time list for a poll, plus its stored time when that is not on a half hour (set before 0.2.3). */
export function timeOptions(current: string): Array<{ label: string; value: string }> {
	if (!current || TIME_OPTIONS.some((item) => item.value === current)) return TIME_OPTIONS;
	return [...TIME_OPTIONS, { label: current, value: current }].sort((a, b) => a.value.localeCompare(b.value));
}

/** A stored ISO time as the date picker's day and the time list's value (UTC), minutes kept as stored. */
export function splitTime(iso: string): { date: string; time: string } {
	const ms = Date.parse(iso);
	if (!iso || Number.isNaN(ms)) return { date: "", time: "00:00" };
	const text = new Date(ms).toISOString();
	return { date: text.slice(0, 10), time: text.slice(11, 16) };
}

/** The date picker's day plus the time list, read as UTC. No day means no time set; a day that is not a real calendar day fails parseTimeField. */
export function joinTime(date: unknown, time: unknown): string {
	const day = asString(date);
	if (!day) return "";
	const real = /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
	if (!real) return "invalid";
	const clock = /^([01]\d|2[0-3]):[0-5]\d$/.test(asString(time)) ? asString(time) : "00:00";
	return `${day}T${clock}:00Z`;
}

/** Keep the stored time exactly (seconds included) when the owner left the day and time as they were. */
export function formTime(stored: string, date: unknown, time: unknown): string {
	const was = splitTime(stored);
	if (stored && was.date === asString(date) && was.time === asString(time)) return stored;
	return joinTime(date, time);
}

export function statusLabel(poll: Poll, now = Date.now()): string {
	const status = effectiveStatus(poll, now);
	if (status === "closed") return "Closed";
	if (status === "open") return "Open";
	if (poll.opens_at && Date.parse(poll.opens_at) > now) return "Scheduled";
	return "Draft";
}

export function attachLabel(poll: Poll): string {
	if (poll.attach === "site") return "Whole site";
	if (poll.attach === "collection") return "A content type";
	if (poll.attach === "entry") return "One page";
	return "Not attached";
}

export async function countVotes(ctx: Ctx, pollId: string): Promise<number> {
	if (!pollId) return 0;
	return ctx.storage[VOTES].count({ poll: pollId });
}

export async function hasVotes(ctx: Ctx, pollId: string): Promise<boolean> {
	return (await countVotes(ctx, pollId)) > 0;
}

export async function deleteVotesForPoll(ctx: Ctx, pollId: string): Promise<number> {
	let removed = 0;
	let cursor: string | undefined;
	for (let step = 0; step < 50; step += 1) {
		const found = await ctx.storage[VOTES].query({
			where: { poll: pollId },
			limit: 100,
			cursor,
		});
		if (found.items.length) {
			removed += await ctx.storage[VOTES].deleteMany(found.items.map((item) => item.id));
		}
		if (!found.hasMore || !found.cursor) break;
		cursor = found.cursor;
	}
	return removed;
}

export type PollRow = Poll & { id: string };

export function entryAttachKey(collection: string, entryId: string): string {
	return `${collection}:${entryId}`;
}

export async function pollForEntry(ctx: Ctx, collection: string, entryId: string): Promise<PollRow | null> {
	return firstAttached(ctx, "entry", entryAttachKey(collection, entryId), "any");
}

/** Poll for this page: newest open at page, then type, then site. If none are open, the newest closed. */
export async function pollForSlot(ctx: Ctx, collection: string, entryId: string): Promise<PollRow | null> {
	const entry = entryAttachKey(collection, entryId);
	const open =
		(await firstAttached(ctx, "entry", entry, "open")) ||
		(collection ? await firstAttached(ctx, "collection", collection, "open") : null) ||
		(await firstAttached(ctx, "site", "", "open"));
	if (open) return open;
	return (
		(await firstAttached(ctx, "entry", entry, "closed")) ||
		(collection ? await firstAttached(ctx, "collection", collection, "closed") : null) ||
		(await firstAttached(ctx, "site", "", "closed"))
	);
}

export async function readSlot(
	ctx: Ctx,
	input: unknown,
): Promise<{ ok: true; poll?: ReturnType<typeof publicPoll>; results?: Awaited<ReturnType<typeof tally>> }> {
	const raw = asRecord(input);
	const row = await pollForSlot(ctx, asString(raw.collection), asString(raw.id));
	if (!row) return { ok: true };
	const live = await applySchedule(ctx, row);
	const status = effectiveStatus(live);
	if (status === "draft") return { ok: true };
	const poll = publicPoll(live, status);
	if (!guestSeesResults(live, status)) return { ok: true, poll };
	return { ok: true, poll, results: await tally(ctx, live) };
}

async function firstAttached(
	ctx: Ctx,
	attach: Poll["attach"],
	key: string,
	want: "open" | "closed" | "any",
): Promise<PollRow | null> {
	if (attach === "entry" && (!key || key.endsWith(":"))) return null;
	const found = await ctx.storage[POLLS].query({
		where: attach === "site" ? undefined : { attach_key: key },
		orderBy: { createdAt: "desc" },
		limit: attach === "site" ? 100 : 25,
	});
	for (const item of found.items) {
		let poll: PollRow = { id: item.id, ...parsePoll(item.data) };
		if (poll.attach !== attach) continue;
		if (want !== "any") {
			poll = await applySchedule(ctx, poll);
			if (effectiveStatus(poll) !== want) continue;
		}
		return poll;
	}
	return null;
}

export async function listVotesForPoll(ctx: Ctx, pollId: string): Promise<Array<Vote & { id: string }>> {
	const rows: Array<Vote & { id: string }> = [];
	let cursor: string | undefined;
	for (let step = 0; step < 50; step += 1) {
		const found = await ctx.storage[VOTES].query({
			where: { poll: pollId },
			limit: 100,
			cursor,
		});
		for (const item of found.items) rows.push({ id: item.id, ...parseVote(item.data) });
		if (!found.hasMore || !found.cursor) break;
		cursor = found.cursor;
	}
	return rows;
}

export function ballotsFromVotes(
	poll: Poll,
	votes: Vote[],
): Array<{ who: string; name: string; labels: string[] }> {
	const byWho = new Map<string, { who: string; name: string; optionIds: string[] }>();
	for (const vote of votes) {
		const who = vote.member_id || (vote.visitor ? `v-${vote.visitor}` : "");
		if (!who) continue;
		const current = byWho.get(who) ?? { who, name: vote.member_name, optionIds: [] };
		const optionId = vote.poll_option.split(":").pop() ?? "";
		if (optionId && !current.optionIds.includes(optionId)) current.optionIds.push(optionId);
		if (vote.member_name) current.name = vote.member_name;
		byWho.set(who, current);
	}
	return [...byWho.values()].map((row) => ({
		who: row.who,
		name: row.name,
		labels: row.optionIds
			.map((id) => poll.options.find((option) => option.id === id)?.label ?? "")
			.filter(Boolean),
	}));
}

export async function deleteVotesForMember(ctx: Ctx, pollId: string, memberId: string): Promise<number> {
	if (!pollId || !memberId) return 0;
	const votes = await listVotesForPoll(ctx, pollId);
	const ids = votes.filter((vote) => vote.member_id === memberId).map((vote) => vote.id);
	if (ids.length) await ctx.storage[VOTES].deleteMany(ids);
	return ids.length;
}

export async function listVotesForMember(ctx: Ctx, memberId: string): Promise<Array<Vote & { id: string }>> {
	if (!memberId) return [];
	const rows: Array<Vote & { id: string }> = [];
	let cursor: string | undefined;
	for (let step = 0; step < 50; step += 1) {
		const found = await ctx.storage[VOTES].query({
			where: { member_id: memberId },
			limit: 100,
			cursor,
		});
		for (const item of found.items) rows.push({ id: item.id, ...parseVote(item.data) });
		if (!found.hasMore || !found.cursor) break;
		cursor = found.cursor;
	}
	return rows;
}

export async function deleteAllVotesForMember(ctx: Ctx, memberId: string): Promise<number> {
	const votes = await listVotesForMember(ctx, memberId);
	const ids = votes.map((vote) => vote.id);
	if (ids.length) await ctx.storage[VOTES].deleteMany(ids);
	return ids.length;
}

export function copyPoll(poll: Poll, now = nowIso()): Poll {
	const suffix = " (copy)";
	const base = poll.question || "Untitled poll";
	const question = `${base.slice(0, Math.max(0, QUESTION_MAX - suffix.length))}${suffix}`;
	return parsePoll({
		...poll,
		question,
		status: "draft",
		createdAt: now,
		rev: newRev(),
		options: poll.options.map((option) => ({ id: newId("o"), label: option.label })),
	});
}

export async function listPolls(
	ctx: Ctx,
	opts: { q?: string; before?: string; after?: string; limit?: number } = {},
): Promise<{ items: PollRow[]; hasOlder: boolean; hasNewer: boolean }> {
	const limit = opts.limit ?? 25;
	const q = asString(opts.q).toLowerCase();
	if (opts.after) {
		const found = await ctx.storage[POLLS].query({
			where: { createdAt: { gt: opts.after } },
			orderBy: { createdAt: "asc" },
			limit: limit + 1,
		});
		const sliced = found.items.slice(0, limit);
		const items = sliced.reverse().map((item) => ({ id: item.id, ...parsePoll(item.data) }));
		return { items, hasOlder: true, hasNewer: found.items.length > limit || found.hasMore };
	}

	const collected: PollRow[] = [];
	let cursor: string | undefined;
	let hasOlder = false;
	for (let step = 0; step < 20 && collected.length < limit + 1; step += 1) {
		const found = await ctx.storage[POLLS].query({
			where: opts.before ? { createdAt: { lt: opts.before } } : undefined,
			orderBy: { createdAt: "desc" },
			limit: q ? 100 : limit + 1,
			cursor,
		});
		for (const item of found.items) {
			const poll = { id: item.id, ...parsePoll(item.data) };
			if (q && !poll.question.toLowerCase().includes(q)) continue;
			collected.push(poll);
			if (collected.length > limit) break;
		}
		hasOlder = collected.length > limit || found.hasMore;
		if (!found.hasMore || !found.cursor || collected.length > limit) break;
		cursor = found.cursor;
	}
	return {
		items: collected.slice(0, limit),
		hasOlder,
		hasNewer: Boolean(opts.before),
	};
}
