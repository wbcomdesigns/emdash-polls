import type { PluginContext } from "emdash/plugin";

import { RATE_LIMITED, SIGN_IN, rateLimited, type Member } from "./core";
import {
	NOT_FOUND,
	applySchedule,
	effectiveStatus,
	getPoll,
	getVote,
	guestSeesResults,
	pollOptionKey,
	publicPoll,
	tally,
	voteRowId,
	type PollRow,
} from "./lib/polls";
import { VOTES } from "./lib/types";
import { asRecord, asString, asStringArray, nowIso } from "./util";

type Ctx = PluginContext;
type RouteCtx = { input: unknown; user?: Member };

const NOT_OPEN = { ok: false as const, error: { code: "NOT_OPEN" } };
const INVALID_CHOICE = { ok: false as const, error: { code: "INVALID_CHOICE" } };
const ALREADY_VOTED = { ok: false as const, error: { code: "ALREADY_VOTED" } };

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

	const previous = await ownChoices(ctx, loaded, user.id);
	if (previous.length && !loaded.allow_change) return ALREADY_VOTED;

	if (previous.length) {
		await ctx.storage[VOTES].deleteMany(previous.map((id) => voteRowId(loaded.id, user.id, id)));
	}
	const now = nowIso();
	const name = loaded.named ? user.name || "" : "";
	await Promise.all(
		choices.map((optionId) =>
			ctx.storage[VOTES].put(voteRowId(loaded.id, user.id, optionId), {
				poll: loaded.id,
				poll_option: pollOptionKey(loaded.id, optionId),
				member_id: user.id,
				createdAt: now,
				visitor: "",
				member_name: name,
			}),
		),
	);
	return reply(ctx, loaded, choices);
}
