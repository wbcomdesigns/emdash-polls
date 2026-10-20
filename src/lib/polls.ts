import type { PluginContext } from "emdash/plugin";

import { MAX_CALLS } from "../core";
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
	DELETING,
	TALLIES,
} from "./types";
import { ensureTally, getTally, resultsOf, zeroTally, type Results } from "./tally";

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

/**
 * Status right now, from the stored status and the dates. Nothing stores it: a draft past its
 * opening time is open, and an open poll past its closing time is closed, on every read.
 */
export function effectiveStatus(poll: Poll, now = Date.now()): PollStatus {
	if (poll.status === "closed") return "closed";
	// A draft that never reached its opening time stays a draft, even past its closing time.
	if (poll.status === "draft" && !(poll.opens_at && Date.parse(poll.opens_at) <= now)) return "draft";
	if (poll.closes_at && Date.parse(poll.closes_at) <= now) return "closed";
	return "open";
}

export function optionLabelsOk(options: PollOption[]): string | null {
	if (options.length < OPTIONS_MIN) return "Add at least two answers.";
	if (options.length > OPTIONS_MAX) return "A poll can have at most ten answers.";
	if (options.some((option) => !option.label)) return "Every answer needs text.";
	return null;
}

/** Rows that a poll query can return, as polls, without polls being deleted. */
export function pollRows(items: Array<{ id: string; data: unknown }>): PollRow[] {
	return items.filter((item) => asRecord(item.data).status !== DELETING).map((item) => ({ id: item.id, ...parsePoll(item.data) }));
}

/**
 * Polls open right now, newest first, from one query of up to 100 stored open or draft polls (a
 * draft past its opening time is open; an open poll past its closing time is not). `more` is true
 * when there were more than 100 to look at.
 */
export async function openPolls(ctx: Ctx): Promise<{ items: PollRow[]; more: boolean }> {
	const found = await ctx.storage[POLLS].query({
		where: { status: { in: ["open", "draft"] } },
		orderBy: { createdAt: "desc" },
		limit: 100,
	});
	return { items: pollRows(found.items).filter((poll) => effectiveStatus(poll) === "open"), more: found.hasMore };
}

export async function countOpenPolls(ctx: Ctx): Promise<number> {
	return (await openPolls(ctx)).items.length;
}

export function guestSeesResults(poll: Poll, status: PollStatus): boolean {
	// Once voting has ended nobody can vote any more, so "after voting" would hide results for good.
	if (poll.results === "always" || status === "closed") return true;
	return false;
}

/**
 * Results for a reader, building the counts first if needed with what is left of the call budget
 * (`used` calls already made). `counting: true` while a poll from before 0.5.0 is still counted.
 */
export async function readResults(
	ctx: Ctx,
	poll: PollRow,
	used: number,
): Promise<{ results?: Results; counting?: true }> {
	const row = await getTally(ctx, poll.id);
	const ready = await ensureTally(ctx, poll, row, MAX_CALLS - used - 1);
	const results = resultsOf(poll, ready);
	return results ? { results } : { counting: true };
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

type PublicRead = { ok: true; poll: ReturnType<typeof publicPoll>; results?: Results; counting?: true };

/** The public answer for one poll: no results when the visitor may not see them yet. */
async function publicRead(ctx: Ctx, row: PollRow, used: number): Promise<PublicRead | { ok: true }> {
	const status = effectiveStatus(row);
	if (status === "draft") return { ok: true };
	const poll = publicPoll(row, status);
	// Counts are built even when results are hidden, so the first vote on a poll from 0.4.0 finds them.
	const read = await readResults(ctx, row, used);
	return guestSeesResults(row, status) ? { ok: true, poll, ...read } : { ok: true, poll };
}

/** `get`: one poll by id, or the newest open one. Status comes from the dates and is never stored. */
export async function readPublicPoll(ctx: Ctx, input: unknown): Promise<typeof NOT_FOUND | PublicRead> {
	const raw = asRecord(input);
	const row = asBoolean(raw.latest) ? (await openPolls(ctx)).items[0] ?? null : await getPoll(ctx, asString(raw.id));
	if (!row || effectiveStatus(row) === "draft") return NOT_FOUND;
	return (await publicRead(ctx, row, 1)) as PublicRead;
}

export async function getPoll(ctx: Ctx, id: string): Promise<(Poll & { id: string }) | null> {
	if (!id) return null;
	const data = await ctx.storage[POLLS].get(id);
	if (!data || asRecord(data).status === DELETING) return null;
	return { id, ...parsePoll(data) };
}

/** A new poll and its zero counts. The counts go first: a stray count record is harmless, a poll without one is not. */
export async function createPoll(ctx: Ctx, id: string, poll: Poll): Promise<void> {
	await ctx.storage[TALLIES].put(id, zeroTally({ id, options: poll.options }));
	await ctx.storage[POLLS].put(id, poll);
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

/** Where a poll shows, in the owner's words. Pass the site's content type names to name the type. */
export function attachLabel(poll: Poll, typeNames?: Map<string, string>): string {
	if (poll.attach === "site") return "Whole site";
	if (poll.attach === "collection") return typeNames?.get(poll.attach_key) ?? "A content type";
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

/**
 * One step of removing a deleted poll: up to 100 of its vote rows, or, once none are left, the poll
 * row itself. Three calls. The poll is hidden from every view from the moment it is marked.
 * Returns false when no poll is waiting.
 */
export async function deleteStep(ctx: Ctx): Promise<boolean> {
	const waiting = (await ctx.storage[POLLS].query({ where: { status: DELETING }, limit: 1 })).items[0];
	if (!waiting) return false;
	const votes = await ctx.storage[VOTES].query({ where: { poll: waiting.id }, limit: 100 });
	if (votes.items.length) await ctx.storage[VOTES].deleteMany(votes.items.map((item) => item.id));
	else await ctx.storage[POLLS].delete(waiting.id);
	return true;
}

export type PollRow = Poll & { id: string };

export function entryAttachKey(collection: string, entryId: string): string {
	return `${collection}:${entryId}`;
}

/** The poll attached to this one entry (any status), newest first. One query. */
export async function pollForEntry(ctx: Ctx, collection: string, entryId: string): Promise<PollRow | null> {
	if (!collection || !entryId) return null;
	const found = await ctx.storage[POLLS].query({
		where: { attach_key: entryAttachKey(collection, entryId) },
		orderBy: { createdAt: "desc" },
		limit: 25,
	});
	return pollRows(found.items).find((poll) => poll.attach === "entry") ?? null;
}

/**
 * Poll for this page: newest open at page, then type, then site. If none are open, the newest
 * closed. One query for all three places; status comes from the dates.
 */
export async function pollForSlot(ctx: Ctx, collection: string, entryId: string): Promise<PollRow | null> {
	const entry = collection && entryId ? entryAttachKey(collection, entryId) : "";
	const found = await ctx.storage[POLLS].query({
		where: { attach: { in: ["entry", "collection", "site"] }, attach_key: { in: [entry || "-", collection || "-", ""] } },
		orderBy: { createdAt: "desc" },
		limit: 100,
	});
	const rows = pollRows(found.items);
	const places: Array<[Poll["attach"], string]> = [
		["entry", entry],
		["collection", collection],
		["site", ""],
	];
	for (const want of ["open", "closed"] as const) {
		for (const [attach, key] of places) {
			if (attach !== "site" && !key) continue;
			const hit = rows.find((poll) => poll.attach === attach && poll.attach_key === key && effectiveStatus(poll) === want);
			if (hit) return hit;
		}
	}
	return null;
}

/**
 * True only for a published entry of a content type that exists. The type is checked first from
 * the schema list: a content read on a type that does not exist rejects across the sandbox bridge,
 * which can hang the sandbox. A missing entry, a draft and an unpublished entry are all false.
 */
export async function entryPublished(
	ctx: Pick<PluginContext, "content" | "schema">,
	collection: string,
	entryId: string,
): Promise<boolean> {
	if (!collection || !entryId || !ctx.content) return false;
	const types = (await ctx.schema?.listCollections().catch(() => null)) ?? [];
	if (!types.some((type) => type.slug === collection)) return false;
	const item = await ctx.content.get(collection, entryId).catch(() => null);
	return item?.status === "published";
}

export async function readSlot(ctx: Ctx & Pick<PluginContext, "content" | "schema">, input: unknown): Promise<PublicRead | { ok: true }> {
	const raw = asRecord(input);
	// Nothing shows for an entry visitors cannot see yet, whatever the poll is attached to (the
	// page, its content type or the whole site). Same empty answer as "no poll here".
	if (!(await entryPublished(ctx, asString(raw.collection), asString(raw.id)))) return { ok: true };
	const row = await pollForSlot(ctx, asString(raw.collection), asString(raw.id));
	return row ? publicRead(ctx, row, 3) : { ok: true };
}

/**
 * One page of a named poll's members and their choices, by member id. A member's rows are never
 * split across pages: a page that ends inside one member's rows stops before that member. One query.
 */
export async function namedPage(
	ctx: Ctx,
	poll: PollRow,
	opts: { after?: string; before?: string; size: number },
): Promise<{ rows: Array<{ who: string; name: string; labels: string[] }>; hasPrev: boolean; hasNext: boolean }> {
	const backwards = Boolean(opts.before);
	const found = await ctx.storage[VOTES].query({
		// Guests have no member id, so `gt ""` keeps the list to members.
		where: { poll: poll.id, member_id: backwards ? { gt: "", lt: opts.before } : { gt: opts.after || "" } },
		orderBy: { member_id: backwards ? "desc" : "asc" },
		limit: 100,
	});
	const byWho = new Map<string, { who: string; name: string; optionIds: string[] }>();
	for (const item of found.items) {
		const vote = parseVote(item.data);
		const current = byWho.get(vote.member_id) ?? { who: vote.member_id, name: "", optionIds: [] };
		const optionId = vote.poll_option.slice(poll.id.length + 1);
		if (optionId && !current.optionIds.includes(optionId)) current.optionIds.push(optionId);
		if (vote.member_name) current.name = vote.member_name;
		byWho.set(vote.member_id, current);
	}
	let groups = [...byWho.values()];
	let more = found.hasMore;
	// The last member read may have more rows on the next page: leave them for that page.
	if (found.hasMore && groups.length > 1) groups = groups.slice(0, -1);
	if (groups.length > opts.size) {
		groups = groups.slice(0, opts.size);
		more = true;
	}
	if (backwards) groups.reverse();
	const rows = groups.map((row) => ({
		who: row.who,
		name: row.name,
		labels: row.optionIds.map((id) => poll.options.find((option) => option.id === id)?.label ?? "").filter(Boolean),
	}));
	return backwards ? { rows, hasPrev: more, hasNext: true } : { rows, hasPrev: Boolean(opts.after), hasNext: more };
}

/** Ids of one member's vote rows on one poll (at most one per answer). One query. */
export async function memberVoteIds(ctx: Ctx, pollId: string, memberId: string): Promise<string[]> {
	if (!pollId || !memberId) return [];
	const found = await ctx.storage[VOTES].query({ where: { poll: pollId, member_id: memberId }, limit: 100 });
	return found.items.map((item) => item.id);
}

/** The answer ids a stored vote row is for. */
export function optionOf(vote: Pick<Vote, "poll" | "poll_option">): string {
	return vote.poll_option.startsWith(`${vote.poll}:`) ? vote.poll_option.slice(vote.poll.length + 1) : vote.poll_option;
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

/**
 * One page of the admin list, newest first. Without a search it is one query. A search reads at
 * most SEARCH_PAGES pages of 100 polls; when it stops there, `olderBound` lets Next carry on.
 */
export async function listPolls(
	ctx: Ctx,
	opts: { q?: string; before?: string; after?: string; limit?: number } = {},
): Promise<{ items: PollRow[]; hasOlder: boolean; hasNewer: boolean; olderBound: string }> {
	const limit = opts.limit ?? 25;
	const q = asString(opts.q).toLowerCase();
	const matches = (poll: PollRow) => !q || poll.question.toLowerCase().includes(q);
	if (opts.after) {
		const found = await ctx.storage[POLLS].query({
			where: { createdAt: { gt: opts.after } },
			orderBy: { createdAt: "asc" },
			limit: 100,
		});
		const all = pollRows(found.items).filter(matches);
		const items = all.slice(0, limit).reverse();
		return { items, hasOlder: true, hasNewer: all.length > limit || found.hasMore, olderBound: items[items.length - 1]?.createdAt ?? "" };
	}

	const collected: PollRow[] = [];
	let cursor: string | undefined;
	let more = false;
	let scanned = "";
	for (let step = 0; step < SEARCH_PAGES; step += 1) {
		const found = await ctx.storage[POLLS].query({
			where: opts.before ? { createdAt: { lt: opts.before } } : undefined,
			orderBy: { createdAt: "desc" },
			limit: q ? 100 : limit + 1,
			cursor,
		});
		for (const poll of pollRows(found.items)) {
			scanned = poll.createdAt;
			if (!matches(poll)) continue;
			collected.push(poll);
			if (collected.length > limit) break;
		}
		more = collected.length > limit || found.hasMore;
		if (!q || !found.hasMore || !found.cursor || collected.length > limit) break;
		cursor = found.cursor;
	}
	const items = collected.slice(0, limit);
	return {
		items,
		hasOlder: more,
		hasNewer: Boolean(opts.before),
		olderBound: collected.length > limit ? (items[items.length - 1]?.createdAt ?? "") : scanned,
	};
}

/** Pages of 100 a search reads in one call. */
const SEARCH_PAGES = 3;
