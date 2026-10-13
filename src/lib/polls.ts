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
