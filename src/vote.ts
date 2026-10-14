import type { PluginContext } from "emdash/plugin";

import { RATE_LIMITED, SIGN_IN, rateLimited, type Member } from "./core";
import {
	NOT_FOUND,
	applySchedule,
	deleteAllVotesForMember,
	effectiveStatus,
	getPoll,
	getVote,
	guestSeesResults,
	listVotesForMember,
	pollOptionKey,
	publicPoll,
	tally,
	visitorWho,
	voteRowId,
	type PollRow,
} from "./lib/polls";
import { requestIp, visitorHash } from "./lib/visitor";
import { VOTES } from "./lib/types";
import { asRecord, asString, asStringArray, nowIso } from "./util";

type Ctx = PluginContext;
type RouteCtx = { input: unknown; user?: Member; requestMeta?: unknown; request?: { method?: string } };

const NOT_OPEN = { ok: false as const, error: { code: "NOT_OPEN" } };
const INVALID_CHOICE = { ok: false as const, error: { code: "INVALID_CHOICE" } };
const ALREADY_VOTED = { ok: false as const, error: { code: "ALREADY_VOTED" } };
const MEMBERS_ONLY = { ok: false as const, error: { code: "MEMBERS_ONLY" } };
const SPAM = { ok: false as const, error: { code: "SPAM" } };
const NO_VISITOR = { ok: false as const, error: { code: "NO_VISITOR" } };

function memberOf(routeCtx: RouteCtx): Member | null {
	const user = routeCtx.user;
	return user?.id ? user : null;
}

async function loadForMember(ctx: Ctx, id: string): Promise<PollRow | typeof NOT_FOUND | typeof NOT_OPEN> {
	const found = await getPoll(ctx, id);
	if (!found) return NOT_FOUND;
	if (found.status === "draft" && effectiveStatus(found) !== "open") return NOT_FOUND;
	const row = await applySchedule(ctx, found);
	if (effectiveStatus(row) === "draft") return NOT_FOUND;
	return row;
}

async function ownChoices(ctx: Ctx, poll: PollRow, memberId: string): Promise<string[]> {
	const choices: string[] = [];
	for (const option of poll.options) {
		if (await getVote(ctx, voteRowId(poll.id, memberId, option.id))) choices.push(option.id);
	}
	return choices;
}

function seesResults(poll: PollRow, status: ReturnType<typeof effectiveStatus>, voted: boolean): boolean {
	if (guestSeesResults(poll, status)) return true;
	return poll.results === "after_vote" && voted;
}

async function reply(ctx: Ctx, poll: PollRow, choices: string[]) {
	const status = effectiveStatus(poll);
	const voted = choices.length > 0;
	const body: {
		ok: true;
		poll: ReturnType<typeof publicPoll>;
		choices: string[];
		thanks?: string;
		results?: Awaited<ReturnType<typeof tally>>;
	} = { ok: true, poll: publicPoll(poll, status), choices };
	if (poll.thanks && voted) body.thanks = poll.thanks;
	if (seesResults(poll, status, voted)) body.results = await tally(ctx, poll);
	return body;
}

export async function handleBallot(routeCtx: RouteCtx, ctx: Ctx) {
	const user = memberOf(routeCtx);
	if (!user) return SIGN_IN;
	const loaded = await loadForMember(ctx, asString(asRecord(routeCtx.input).id));
	if ("error" in loaded) return loaded;
	return reply(ctx, loaded, await ownChoices(ctx, loaded, user.id));
}

export async function handleVote(routeCtx: RouteCtx, ctx: Ctx) {
	const user = memberOf(routeCtx);
	if (!user) return SIGN_IN;
	if (await rateLimited(ctx, `vote:${user.id}`)) return RATE_LIMITED;

	const raw = asRecord(routeCtx.input);
	const loaded = await loadForMember(ctx, asString(raw.id));
	if ("error" in loaded) return loaded;
	if (effectiveStatus(loaded) !== "open") return NOT_OPEN;

	const allowed = new Set(loaded.options.map((option) => option.id));
	const choices = [...new Set(asStringArray(raw.choices))];
	if (!choices.length || choices.some((id) => !allowed.has(id))) return INVALID_CHOICE;
	if (!loaded.multiple && choices.length !== 1) return INVALID_CHOICE;

	return saveChoices(ctx, loaded, {
		who: user.id,
		memberId: user.id,
		visitor: "",
		name: loaded.named ? user.name || "" : "",
		choices,
	});
}

export async function handleBallotGuest(routeCtx: RouteCtx, ctx: Ctx) {
	const raw = asRecord(routeCtx.input);
	const who = await guestWho(ctx, routeCtx, raw);
	if ("error" in who) return who;
	const loaded = await loadForMember(ctx, asString(raw.id));
	if ("error" in loaded) return loaded;
	if (loaded.who === "members") return { ok: true, poll: publicPoll(loaded, effectiveStatus(loaded)), choices: [] as string[] };
	return reply(ctx, loaded, await ownChoices(ctx, loaded, who.who));
}

export async function handleVoteGuest(routeCtx: RouteCtx, ctx: Ctx) {
	const raw = asRecord(routeCtx.input);
	if (asString(raw.website) || asString(raw.honeypot)) return SPAM;
	const who = await guestWho(ctx, routeCtx, raw);
	if ("error" in who) return who;
	if (await rateLimited(ctx, `vote:${who.who}`)) return RATE_LIMITED;

	const loaded = await loadForMember(ctx, asString(raw.id));
	if ("error" in loaded) return loaded;
	if (loaded.who === "members") return MEMBERS_ONLY;
	if (effectiveStatus(loaded) !== "open") return NOT_OPEN;

	const allowed = new Set(loaded.options.map((option) => option.id));
	const choices = [...new Set(asStringArray(raw.choices))];
	if (!choices.length || choices.some((id) => !allowed.has(id))) return INVALID_CHOICE;
	if (!loaded.multiple && choices.length !== 1) return INVALID_CHOICE;

	return saveChoices(ctx, loaded, {
		who: who.who,
		memberId: "",
		visitor: who.hash,
		name: "",
		choices,
	});
}

async function guestWho(ctx: Ctx, routeCtx: RouteCtx, raw: Record<string, unknown>) {
	const hash = await visitorHash(ctx, requestIp(routeCtx), asString(raw.visitor));
	if (!hash) return NO_VISITOR;
	return { who: visitorWho(hash), hash };
}

async function saveChoices(
	ctx: Ctx,
	poll: PollRow,
	opts: { who: string; memberId: string; visitor: string; name: string; choices: string[] },
) {
	const previous = await ownChoices(ctx, poll, opts.who);
	if (previous.length && !poll.allow_change) return ALREADY_VOTED;
	if (previous.length) {
		await ctx.storage[VOTES].deleteMany(previous.map((id) => voteRowId(poll.id, opts.who, id)));
	}
	const now = nowIso();
	await Promise.all(
		opts.choices.map((optionId) =>
			ctx.storage[VOTES].put(voteRowId(poll.id, opts.who, optionId), {
				poll: poll.id,
				poll_option: pollOptionKey(poll.id, optionId),
				member_id: opts.memberId,
				createdAt: now,
				visitor: opts.visitor,
				member_name: opts.name,
			}),
		),
	);
	return reply(ctx, poll, opts.choices);
}

export async function handleMine(routeCtx: RouteCtx, ctx: Ctx) {
	const user = memberOf(routeCtx);
	if (!user) return SIGN_IN;
	const method = asString(routeCtx.request?.method) || "GET";
	return method === "DELETE" ? eraseMine(routeCtx, ctx, user.id) : listMine(ctx, user.id);
}

async function listMine(ctx: Ctx, memberId: string) {
	const votes = await listVotesForMember(ctx, memberId);
	const byPoll = new Map<string, string[]>();
	for (const vote of votes) {
		const optionId = vote.poll_option.includes(":")
			? vote.poll_option.slice(vote.poll_option.indexOf(":") + 1)
			: vote.poll_option;
		const list = byPoll.get(vote.poll) ?? [];
		list.push(optionId);
		byPoll.set(vote.poll, list);
	}
	const items = [];
	for (const [pollId, optionIds] of byPoll) {
		const poll = await getPoll(ctx, pollId);
		if (!poll) continue;
		const unique = [...new Set(optionIds)];
		items.push({
			id: poll.id,
			question: poll.question,
			status: effectiveStatus(poll),
			labels: unique
				.map((id) => poll.options.find((option) => option.id === id)?.label ?? "")
				.filter(Boolean),
		});
	}
	return { ok: true as const, items };
}

async function eraseMine(routeCtx: RouteCtx, ctx: Ctx, memberId: string) {
	if (await rateLimited(ctx, `erase:${memberId}`)) return RATE_LIMITED;
	const raw = asRecord(routeCtx.input);
	if (asString(raw.member_id) && asString(raw.member_id) !== memberId) {
		/* A typed id is ignored. Only the signed-in caller is erased. */
	}
	const erased = await deleteAllVotesForMember(ctx, memberId);
	return { ok: true as const, erased };
}
