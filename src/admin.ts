import type { PluginContext } from "emdash/plugin";

import {
	applyOptionEdits,
	attachLabel,
	copyPoll,
	createPoll,
	deleteStep,
	emptyPoll,
	getPoll,
	hasVotes,
	listPolls,
	memberVoteIds,
	namedPage,
	newId,
	newRev,
	answerFields,
	answersFromForm,
	openPolls,
	parsePoll,
	formTime,
	parseTimeField,
	splitTime,
	timeOptions,
	statusLabel,
	type PollRow,
} from "./lib/polls";
import { applyVoteDelta, buildMissing, ensureTally, getTally, parseTally, restartTally, resultsOf, totalOf, type Tally } from "./lib/tally";
import { DELETING, QUESTION_MAX, TALLIES, THANKS_MAX, VOTES, type Poll } from "./lib/types";
import { MAX_CALLS } from "./core";
import { asBoolean, asRecord, asString } from "./util";

type Toast = { message: string; type: "success" | "error" | "info" };
export type BlockMap = Record<string, unknown> & { type: string };
export type BlockResponse = { blocks: BlockMap[]; toast?: Toast };

type Ctx = PluginContext;
type Extra = Pick<BlockResponse, "toast">;
type SiteCollection = { slug: string; label: string };

const typesRead = new WeakMap<object, Promise<SiteCollection[]>>();

/** Content types on the site, by their normal names. Hidden types stay out. Read once per plugin call. */
function siteCollections(ctx: Ctx): Promise<SiteCollection[]> {
	let found = typesRead.get(ctx);
	if (!found) {
		found = (async () =>
			((await ctx.schema?.listCollections()) ?? [])
				.filter((item) => !item.hidden)
				.map((item) => ({ slug: item.slug, label: item.label || item.labelSingular || item.slug })))();
		typesRead.set(ctx, found);
	}
	return found;
}

const PAGE = 25;
const NAMED_PAGE = 25;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Calls the polls list makes without a search: the page, content types, counts, two stats, the setup card. */
const LIST_CALLS = 6;
/** Calls a list load with nothing else to do may spend on upkeep (removing a deleted poll, counting older polls). */
const UPKEEP = MAX_CALLS - LIST_CALLS;

function link(label: string, path: string) {
	return { type: "link", label, target: { kind: "plugin-page", path } };
}

function stamped(action: string, id: string, rev: string, extra = ""): string {
	return extra ? `${action}|${rev}|${id}|${extra}` : `${action}|${rev}|${id}`;
}

function parseStamped(value: unknown): { action: string; rev: string; id: string; extra: string } {
	const [action = "", rev = "", id = "", ...rest] = asString(value).split("|");
	return { action, rev, id, extra: rest.join("|") };
}

function extraOf(value: unknown): string {
	return parseStamped(value).extra;
}

function select(
	actionId: string,
	label: string,
	value: string,
	options: Array<{ label: string; value: string }>,
) {
	return { type: "select", action_id: actionId, label, initial_value: value, options };
}

function statusError(row: Poll | null, rev: string): string | null {
	if (!row) return "That poll is gone.";
	if (row.rev !== rev) return "Someone else changed this poll. Open it again.";
	return null;
}

async function listStats(ctx: Ctx): Promise<BlockMap> {
	const open = await openPolls(ctx);
	const since = new Date(Date.now() - WEEK_MS).toISOString();
	const votes = await ctx.storage[VOTES].count({ createdAt: { gte: since } });
	return {
		type: "stats",
		items: [
			{ label: "Open polls", value: `${open.items.length}${open.more ? "+" : ""}` },
			{ label: "Votes this week", value: String(votes) },
		],
	};
}

/** Stored counts for the listed polls, in one read. */
async function talliesFor(ctx: Ctx, polls: PollRow[]): Promise<Map<string, Tally>> {
	const found = polls.length ? await ctx.storage[TALLIES].getMany(polls.map((poll) => poll.id)) : new Map<string, unknown>();
	const out = new Map<string, Tally>();
	for (const [id, data] of found) {
		const row = parseTally(data);
		if (row) out.set(id, row);
	}
	return out;
}

/**
 * Upkeep on a list load that has `spare` calls left: one step of removing a deleted poll's votes,
 * or, when none is waiting, counting the listed polls from 0.4.0 that have no counts yet.
 */
async function upkeep(ctx: Ctx, spare: number, listed: PollRow[], tallies: Map<string, Tally>): Promise<void> {
	if (spare < 3 || (await deleteStep(ctx))) return;
	const missing = listed.filter((poll) => !tallies.has(poll.id));
	for (const [id, row] of await buildMissing(ctx, missing)) tallies.set(id, row);
}

function displayStatus(poll: Poll): string {
	return statusLabel(poll);
}

/** The polls list. `spare`: calls the caller leaves for upkeep (only a plain list load leaves any). */
export async function renderList(
	ctx: Ctx,
	opts: { q?: string; before?: string; after?: string } = {},
	extra?: Extra,
	spare = 0,
): Promise<BlockResponse> {
	const q = asString(opts.q);
	const listed = await listPolls(ctx, { q, before: opts.before, after: opts.after, limit: PAGE });
	const typeNames = new Map((await siteCollections(ctx)).map((type) => [type.slug, type.label]));
	const tallies = await talliesFor(ctx, listed.items);
	await upkeep(ctx, spare, listed.items, tallies);
	const rows = await Promise.all(
		listed.items.map(async (poll) => {
			const votes = totalOf(poll, tallies.get(poll.id) ?? null);
			const items: Array<{ label: string; value: string }> = [{ label: "Edit", value: stamped("edit", poll.id, poll.rev) }];
			if (displayStatus(poll) !== "Open") {
				items.push({ label: "Open", value: stamped("open", poll.id, poll.rev) });
			}
			if (displayStatus(poll) === "Open") {
				items.push({ label: "Close", value: stamped("close", poll.id, poll.rev) });
			}
			items.push({ label: "Results", value: stamped("results", poll.id, poll.rev) });
			items.push({ label: "Copy", value: stamped("copy", poll.id, poll.rev) });
			items.push({ label: "Delete", value: stamped("delete", poll.id, poll.rev) });
			return {
				poll: poll.question || "Untitled poll",
				who: `${poll.who === "members" ? "Members" : "Anyone"}, ${poll.named ? "named" : "anonymous"}`,
				where: attachLabel(poll, typeNames),
				votes: votes === null ? "Counting" : String(votes),
				status: displayStatus(poll),
				action: { type: "menu", action_id: "poll_mod", label: "Actions", items },
			};
		}),
	);

	const nav: BlockMap[] = [];
	if (listed.hasNewer || listed.hasOlder) {
		const elements: Array<Record<string, unknown>> = [];
		if (listed.hasNewer && listed.items[0]) {
			elements.push({
				type: "button",
				label: "Previous",
				action_id: "page",
				value: `after|${listed.items[0].createdAt}|${q}`,
			});
		}
		if (listed.hasOlder && listed.olderBound) {
			elements.push({
				type: "button",
				label: "Next",
				action_id: "page",
				value: `before|${listed.olderBound}|${q}`,
			});
		}
		if (elements.length) nav.push({ type: "actions", elements });
	}

	const body: BlockMap[] =
		rows.length === 0
			? [
					{
						type: "empty",
						title: q ? (listed.hasOlder ? "No match among the newest polls" : "No polls match that question") : "No polls yet",
						description: q
							? listed.hasOlder
								? "Older polls were not searched yet. Choose Next to search them."
								: "Try a different search, or create a poll."
							: "Ask a question, add two or more answers, then open the poll.",
						actions: [link("Create a poll", "/edit")],
					},
					// A search reads a few hundred polls per call, so a match can be further back.
					...nav,
				]
			: [
					{
						type: "table",
						page_action_id: "polls_page",
						columns: [
							{ key: "poll", label: "Poll" },
							{ key: "who", label: "Who can vote" },
							{ key: "where", label: "Shows on" },
							{ key: "votes", label: "Votes" },
							{ key: "status", label: "Status", format: "badge" },
							{ key: "action", label: "Actions", format: "element" },
						],
						rows,
					},
					...nav,
				];

	return {
		blocks: [
			{ type: "header", text: "Polls" },
			await listStats(ctx),
			{
				type: "section",
				text: "Create a poll, open it when you are ready, then close it when voting should stop.",
				accessory: link("Create a poll", "/edit"),
			},
			{
				type: "form",
				block_id: "find",
				fields: [
					{
						type: "text_input",
						action_id: "q",
						label: "Find by question",
						initial_value: q,
					},
				],
				submit: { action_id: "find", label: "Find" },
			},
			...body,
		],
		toast: extra?.toast,
	};
}

export async function renderForm(
	ctx: Ctx,
	id: string,
	extra?: Extra & { values?: Record<string, unknown> },
): Promise<BlockResponse> {
	const existing = id ? await getPoll(ctx, id) : null;
	const poll = existing ?? emptyPoll();
	const voted = existing ? await hasVotes(ctx, existing.id) : false;
	const values = extra?.values ?? {};
	const question = asString(values.question) || poll.question;
	const opensAt = splitTime(poll.opens_at);
	const closesAt = splitTime(poll.closes_at);
	const answerLabels =
		"answer_1" in values
			? answersFromForm(values, voted ? poll.options.length : 0)
			: poll.options.map((option) => option.label);
	const lockedNote =
		"This poll has votes. You can correct the question and the wording of an answer. You cannot add, remove or reorder answers, and you cannot switch between one choice and several.";
	const types = await siteCollections(ctx);
	const currentType =
		asString(values.attach_key) || (poll.attach === "collection" ? poll.attach_key : "");
	const typeOptions = [
		{ label: "Choose a content type", value: "" },
		...types.map((item) => ({ label: item.label, value: item.slug })),
	];
	if (currentType && !typeOptions.some((item) => item.value === currentType)) {
		typeOptions.push({ label: currentType, value: currentType });
	}

	return {
		blocks: [
			{ type: "header", text: existing ? "Edit poll" : "New poll" },
			...(voted ? [{ type: "banner" as const, variant: "default" as const, title: lockedNote }] : []),
			{
				type: "context",
				text: "One Save stores the question, who can vote, where it shows, and when results appear. Shows once the page or post is published.",
			},
			{
				type: "form",
				block_id: "poll",
				// Order follows the owner's decisions: what to ask, who votes, what voters see,
				// where it shows, when it runs. Fields that do not apply stay hidden.
				fields: [
					{
						type: "text_input",
						action_id: "question",
						label: "Question",
						placeholder: "Which feature should we build next?",
						initial_value: question,
					},
					...answerFields(answerLabels, voted),
					{
						type: "toggle",
						action_id: "multiple",
						label: "Allow more than one answer",
						initial_value: asBoolean(values.multiple ?? poll.multiple),
					},
					select("who", "Who can vote", asString(values.who) || poll.who, [
						{ label: "Anyone", value: "anyone" },
						{ label: "Signed-in members only", value: "members" },
					]),
					{
						type: "toggle",
						action_id: "named",
						label: "Show each member's choice to the site owner",
						initial_value: asBoolean(values.named ?? poll.named),
					},
					{
						type: "toggle",
						action_id: "allow_change",
						label: "Members may change their vote while the poll is open",
						initial_value: asBoolean(values.allow_change ?? poll.allow_change),
					},
					select("results", "When to show results", asString(values.results) || poll.results, [
						{ label: "Always", value: "always" },
						{ label: "After voting", value: "after_vote" },
						{ label: "After the poll closes", value: "after_close" },
					]),
					select("numbers", "Numbers visitors see", asString(values.numbers) || poll.numbers, [
						{ label: "Percent and count", value: "full" },
						{ label: "Percent only", value: "percent" },
					]),
					{
						type: "text_input",
						action_id: "thanks",
						label: "Thank-you line after voting (optional)",
						placeholder: "Thanks, your vote is in.",
						initial_value: asString(values.thanks) || poll.thanks,
					},
					select("attach", "Where it shows (once the page or post is published)", asString(values.attach) || poll.attach, [
						{ label: "Not attached", value: "none" },
						{ label: "Whole site", value: "site" },
						{ label: "One content type", value: "collection" },
						...(poll.attach === "entry"
							? [{ label: "One page (set from the page editor)", value: "entry" }]
							: []),
					]),
					{
						...select("attach_key", "Content type", currentType, typeOptions),
						condition: { field: "attach", eq: "collection" },
					},
					{
						...select("position", "Position on the page", asString(values.position) || poll.position, [
							{ label: "Below the content", value: "below" },
							{ label: "Above the content", value: "above" },
						]),
						condition: { field: "attach", neq: "none" },
					},
					{
						type: "date_input",
						action_id: "opens_date",
						label: "Opens on (optional, a draft opens by itself that day)",
						initial_value: "opens_date" in values ? asString(values.opens_date) : opensAt.date,
					},
					{
						...select("opens_time", "Opens at (UTC)", asString(values.opens_time) || opensAt.time, timeOptions(opensAt.time)),
						condition: { field: "opens_date", neq: "" },
					},
					{
						type: "date_input",
						action_id: "closes_date",
						label: "Closes on (optional)",
						initial_value: "closes_date" in values ? asString(values.closes_date) : closesAt.date,
					},
					{
						...select("closes_time", "Closes at (UTC)", asString(values.closes_time) || closesAt.time, timeOptions(closesAt.time)),
						condition: { field: "closes_date", neq: "" },
					},
				],
				submit: {
					action_id: stamped("save", existing?.id ?? "", poll.rev),
					label: existing ? "Save poll" : "Create poll",
				},
			},
			{ type: "actions", elements: [link("Back to polls", "/polls")] },
		],
		toast: extra?.toast,
	};
}

export async function renderOpenWidget(ctx: Ctx): Promise<BlockResponse> {
	const open = (await openPolls(ctx)).items.slice(0, 8);
	if (open.length === 0) {
		return {
			blocks: [
				{ type: "section", text: "No open polls." },
				{ type: "actions", elements: [link("Polls", "/polls")] },
			],
		};
	}
	const tallies = await talliesFor(ctx, open);
	const rows = open.map((poll) => {
		const votes = totalOf(poll, tallies.get(poll.id) ?? null);
		return { question: poll.question, votes: votes === null ? "Counting" : String(votes) };
	});
	return {
		blocks: [
			{
				type: "table",
				page_action_id: "open_widget",
				columns: [
					{ key: "question", label: "Open poll" },
					{ key: "votes", label: "Votes" },
				],
				rows,
			},
			{ type: "actions", elements: [link("All polls", "/polls")] },
		],
	};
}

/**
 * The Results screen. `used`: calls the action made before this render; what is left of the budget
 * goes to counting a poll from 0.4.0. `page`: `a:<member id>` (after) or `b:<member id>` (before)
 * for the named list; anything else is the first page.
 */
async function renderResults(
	ctx: Ctx,
	poll: PollRow,
	opts: { extra?: Extra; page?: string; tally?: Tally | null; used: number },
): Promise<BlockResponse> {
	let used = opts.used;
	let row = opts.tally;
	if (row === undefined) {
		row = await getTally(ctx, poll.id);
		used += 1;
	}
	// One call is kept for the named list.
	const ready = await ensureTally(ctx, poll, row, MAX_CALLS - used - (poll.named ? 1 : 0));
	const results = resultsOf(poll, ready);
	const [dir, bound = ""] = (opts.page ?? "").split(/:(.*)/s);
	const named = poll.named
		? await namedPage(ctx, poll, { size: NAMED_PAGE, after: dir === "a" ? bound : "", before: dir === "b" ? bound : "" })
		: null;
	const namedRows = (named?.rows ?? []).map((row) => ({
		who: row.name || "A member",
		choice: row.labels.join(", ") || "No choice",
		action: {
			type: "button",
			action_id: "poll_mod",
			label: "Remove votes",
			style: "danger",
			value: stamped("erase", poll.id, poll.rev, row.who),
			confirm: {
				title: "Remove these votes?",
				text: "This person can vote again if the poll is still open.",
				confirm: "Remove",
				deny: "Keep them",
			},
		},
	}));
	const namedNav: BlockMap[] = [];
	if (named && namedRows.length) {
		const elements: Array<Record<string, unknown>> = [];
		const first = named.rows[0]?.who ?? "";
		const last = named.rows[named.rows.length - 1]?.who ?? "";
		if (named.hasPrev) elements.push({ type: "button", label: "Previous", action_id: "poll_mod", value: stamped("results", poll.id, poll.rev, `b:${first}`) });
		if (named.hasNext) elements.push({ type: "button", label: "Next", action_id: "poll_mod", value: stamped("results", poll.id, poll.rev, `a:${last}`) });
		if (elements.length) namedNav.push({ type: "actions", elements });
	}
	const counted = ready ? Math.min(ready.step, poll.options.length) : 0;
	const counting: BlockMap[] = results
		? []
		: [
				{
					type: "banner",
					variant: "default",
					title: "Counting votes",
					description: `This poll's votes are being counted again from the stored votes: ${counted} of ${poll.options.length} answers so far. Visitors see the results once every answer is counted.`,
				},
				{ type: "actions", elements: [{ type: "button", label: "Continue counting", action_id: "poll_mod", style: "primary", value: stamped("results", poll.id, poll.rev) }] },
			];

	return {
		blocks: [
			{ type: "header", text: "Results" },
			{ type: "section", text: poll.question || "Untitled poll" },
			...counting,
			{
				type: "stats",
				items: [
					{ label: "Votes", value: results ? String(results.total) : "Counting" },
					{ label: "Answers", value: String(poll.options.length) },
					{ label: "Status", value: displayStatus(poll) },
				],
			},
			...(results
				? [
						{
							type: "chart",
							config: {
								chart_type: "custom",
								height: 240,
								options: {
									grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
									tooltip: { trigger: "item" },
									xAxis: { type: "value", minInterval: 1 },
									yAxis: {
										type: "category",
										data: results.options.map((row) => (row.label.length > 24 ? `${row.label.slice(0, 24)}...` : row.label)),
									},
									series: [{ type: "bar", data: results.options.map((row) => row.count) }],
								},
							},
						} as BlockMap,
					]
				: []),
			{
				type: "context",
				text: poll.named
					? "Named: each signed-in member and their choice. Guests stay anonymous."
					: "Anonymous: totals only. Names are not stored.",
			},
			...(results
				? [
						{
							type: "table",
							page_action_id: "poll_results",
							columns: [
								{ key: "label", label: "Answer" },
								{ key: "count", label: "Votes" },
								{ key: "percent", label: "Share" },
							],
							rows: results.options.map((row) => ({
								label: row.label,
								count: String(row.count),
								percent: `${row.percent}%`,
							})),
						} as BlockMap,
					]
				: []),
			...(named
				? namedRows.length
					? [
							{
								type: "table",
								page_action_id: "poll_named",
								columns: [
									{ key: "who", label: "Member" },
									{ key: "choice", label: "Choice" },
									{ key: "action", label: "Erase", format: "element" },
								],
								rows: namedRows,
							} as BlockMap,
							...namedNav,
						]
					: [{ type: "empty", title: "No named votes yet", description: "Totals above still count guest votes." } as BlockMap]
				: []),
			{
				type: "actions",
				elements: [
					link("Back to polls", "/polls"),
					{
						type: "button",
						label: "Recount votes",
						action_id: "poll_mod",
						value: stamped("recount", poll.id, poll.rev),
						confirm: {
							title: "Count this poll's votes again?",
							text: "The totals are counted again from the stored votes, a few answers at a time. Visitors see the results again once every answer is counted.",
							confirm: "Recount",
							deny: "Cancel",
						},
					},
				],
			},
		],
		toast: opts.extra?.toast,
	};
}

async function savePoll(ctx: Ctx, values: Record<string, unknown>): Promise<BlockResponse> {
	const id = asString(values.id);
	const existing = id ? await getPoll(ctx, id) : null;
	if (id && !existing) {
		return renderForm(ctx, "", { toast: { message: "That poll is gone.", type: "error" }, values });
	}
	if (existing && existing.rev !== asString(values.rev)) {
		return renderForm(ctx, existing.id, {
			toast: { message: "Someone else changed this poll. Open it again.", type: "error" },
		});
	}

	const question = asString(values.question);
	if (!question) {
		return renderForm(ctx, existing?.id ?? "", {
			toast: { message: "Write a question.", type: "error" },
			values,
		});
	}
	if (question.length > QUESTION_MAX) {
		return renderForm(ctx, existing?.id ?? "", {
			toast: { message: `Keep the question to ${QUESTION_MAX} characters.`, type: "error" },
			values,
		});
	}

	const voted = existing ? await hasVotes(ctx, existing.id) : false;
	const options = applyOptionEdits(existing?.options ?? [], answersFromForm(values, voted ? existing?.options.length : 0), voted);
	if (!options.ok) {
		return renderForm(ctx, existing?.id ?? "", { toast: { message: options.error, type: "error" }, values });
	}

	const opens = parseTimeField(formTime(existing?.opens_at ?? "", values.opens_date, values.opens_time));
	const closes = parseTimeField(formTime(existing?.closes_at ?? "", values.closes_date, values.closes_time));
	if (!opens.ok) return renderForm(ctx, existing?.id ?? "", { toast: { message: opens.error, type: "error" }, values });
	if (!closes.ok) return renderForm(ctx, existing?.id ?? "", { toast: { message: closes.error, type: "error" }, values });

	const thanks = asString(values.thanks);
	if (thanks.length > THANKS_MAX) {
		return renderForm(ctx, existing?.id ?? "", {
			toast: { message: `Keep the thank-you line to ${THANKS_MAX} characters.`, type: "error" },
			values,
		});
	}

	let multiple = asBoolean(values.multiple);
	let named = asBoolean(values.named);
	if (voted && existing) {
		if (multiple !== existing.multiple) {
			return renderForm(ctx, existing.id, {
				toast: { message: "This poll has votes, so one choice or several is locked.", type: "error" },
				values,
			});
		}
		if (named !== existing.named) {
			return renderForm(ctx, existing.id, {
				toast: { message: "This poll has votes, so anonymous or named is locked.", type: "error" },
				values,
			});
		}
		multiple = existing.multiple;
		named = existing.named;
	}

	const attach = asString(values.attach) || "none";
	let attach_key = "";
	if (attach === "collection") {
		attach_key = asString(values.attach_key);
		const known = new Set((await siteCollections(ctx)).map((item) => item.slug));
		if (!attach_key) {
			return renderForm(ctx, existing?.id ?? "", {
				toast: { message: "Pick a content type.", type: "error" },
				values,
			});
		}
		if (known.size && !known.has(attach_key) && existing?.attach_key !== attach_key) {
			return renderForm(ctx, existing?.id ?? "", {
				toast: { message: "Pick a content type from the list.", type: "error" },
				values,
			});
		}
	} else if (attach === "entry") {
		attach_key = existing?.attach_key ?? "";
		if (!attach_key) {
			return renderForm(ctx, existing?.id ?? "", {
				toast: { message: "Attach a poll to one page from that page's Poll panel.", type: "error" },
				values,
			});
		}
	}

	const next = parsePoll({
		...existing,
		question,
		options: options.options,
		multiple,
		allow_change: asBoolean(values.allow_change),
		results: asString(values.results) || "always",
		who: asString(values.who) || "anyone",
		named,
		opens_at: opens.value,
		closes_at: closes.value,
		thanks,
		attach,
		attach_key,
		position: asString(values.position) || "below",
		numbers: asString(values.numbers) || "full",
		status: existing?.status ?? "draft",
		createdAt: existing?.createdAt,
		rev: newRev(),
	});

	const pollId = existing?.id || newId("p");
	if (existing) {
		const applied = await ctx.storage.polls.updateIf(pollId, {
			where: { rev: existing.rev },
			set: next,
		});
		if (!applied.applied) {
			return renderForm(ctx, pollId, {
				toast: { message: "Someone else changed this poll. Open it again.", type: "error" },
			});
		}
		return renderList(ctx, {}, { toast: { message: "Poll saved.", type: "success" } });
	}

	await createPoll(ctx, pollId, next);
	return renderList(ctx, {}, { toast: { message: "Poll created.", type: "success" } });
}

async function moderate(ctx: Ctx, value: unknown): Promise<BlockResponse> {
	const { action, rev, id } = parseStamped(value);
	const poll = await getPoll(ctx, id);
	const stale = statusError(poll, rev);
	if (stale) return renderList(ctx, {}, { toast: { message: stale, type: "error" } });
	if (!poll) return renderList(ctx, {}, { toast: { message: "That poll is gone.", type: "error" } });

	if (action === "edit") return renderForm(ctx, poll.id);
	if (action === "results") return renderResults(ctx, poll, { page: extraOf(value), used: 1 });
	if (action === "recount") {
		const tally = await restartTally(ctx, poll.id);
		return renderResults(ctx, poll, { tally, used: 2, extra: { toast: { message: "Counting the votes again.", type: "info" } } });
	}
	if (action === "copy") {
		const copyId = newId("p");
		await createPoll(ctx, copyId, copyPoll(poll));
		return renderForm(ctx, copyId, {
			toast: { message: "Rename this copy, then open it.", type: "success" },
		});
	}
	if (action === "erase") {
		const memberId = extraOf(value);
		if (!memberId) {
			return renderResults(ctx, poll, { used: 1, extra: { toast: { message: "Pick a member to remove.", type: "error" } } });
		}
		const ids = await memberVoteIds(ctx, poll.id, memberId);
		if (!ids.length) return renderResults(ctx, poll, { used: 2, extra: { toast: { message: "No votes to remove.", type: "info" } } });
		await ctx.storage[VOTES].deleteMany(ids);
		// The rows were deleted: the count update cannot fail this answer (applyVoteDelta never throws).
		const tally = await applyVoteDelta(ctx, poll, [], ids.map((id) => id.slice(id.lastIndexOf(":") + 1)));
		return renderResults(ctx, poll, { tally, used: 4, extra: { toast: { message: "Those votes were removed.", type: "success" } } });
	}

	if (action === "open") {
		const applied = await ctx.storage.polls.updateIf(poll.id, {
			where: { rev: poll.rev },
			set: { status: "open", rev: newRev() },
		});
		if (!applied.applied) {
			return renderList(ctx, {}, { toast: { message: "Someone else changed this poll. Open it again.", type: "error" } });
		}
		return renderList(ctx, {}, { toast: { message: "Poll opened.", type: "success" } });
	}

	if (action === "close") {
		const applied = await ctx.storage.polls.updateIf(poll.id, {
			where: { rev: poll.rev },
			set: { status: "closed", rev: newRev() },
		});
		if (!applied.applied) {
			return renderList(ctx, {}, { toast: { message: "Someone else changed this poll. Open it again.", type: "error" } });
		}
		return renderList(ctx, {}, { toast: { message: "Poll closed.", type: "success" } });
	}

	if (action === "delete") {
		const list = await renderList(ctx);
		return {
			...list,
			blocks: [
				{
					type: "banner",
					variant: "alert",
					title: "Delete this poll?",
					description: `"${poll.question || "Untitled poll"}" and its votes will be gone. This cannot be undone.`,
				},
				{
					type: "actions",
					elements: [
						{
							type: "button",
							label: "Delete poll",
							action_id: "delete_confirm",
							style: "danger",
							value: stamped("delete_confirm", poll.id, poll.rev),
						},
						link("Keep it", "/polls"),
					],
				},
				...list.blocks,
			],
		};
	}

	if (action === "delete_confirm") {
		// One write hides the poll from every visitor and admin view. Its votes are removed a hundred
		// at a time by later list loads (see deleteStep), then the poll row itself.
		const applied = await ctx.storage.polls.updateIf(poll.id, {
			where: { rev: poll.rev },
			set: { status: DELETING, attach: "none", attach_key: "", rev: `deleting:${poll.rev}` },
		});
		if (!applied.applied) {
			return renderList(ctx, {}, { toast: { message: "Someone else changed this poll. Open it again.", type: "error" } });
		}
		await ctx.storage[TALLIES].delete(poll.id).catch(() => undefined);
		return renderList(ctx, {}, { toast: { message: "Poll deleted.", type: "success" } });
	}

	return renderList(ctx, {}, { toast: { message: "Unknown action.", type: "error" } });
}

const KIT_DONE = "kit_pages_done";

/** The shared six-line kit command, every line 52 characters or fewer: an admin code block neither wraps nor scrolls. */
export function kitCommand(tag: string): string {
	return [
		`kit="$(mktemp -d)" &&`,
		`  git clone --depth 1 \\`,
		`    --branch ${tag} \\`,
		`    ${REPO_URL} \\`,
		`    "$kit/emdash-polls" &&`,
		`  "$kit/emdash-polls/scripts/add-to-site.sh" .`,
	].join("\n");
}
const REPO_URL = "https://github.com/wbcomdesigns/emdash-polls";

/**
 * The "Set up visitor pages" card. A registry plugin cannot add pages or put a poll on one, so until
 * the site kit is copied no poll shows anywhere and /account/votes is the site's 404. The card gives
 * the command for the version that is installed (never main), until the owner says the pages are
 * set up; then one line to the guide. "Done" is stored with the version, so the card comes back
 * after every plugin update, when the kit has to be copied again.
 */
export async function kitBlocks(ctx: Ctx): Promise<BlockMap[]> {
	const tag = `v${ctx.plugin.version}`;
	const guide = {
		type: "link",
		label: "Install guide",
		target: { kind: "external", url: `${REPO_URL}/blob/${tag}/docs/website/getting-started/install.md` },
	};
	if ((await ctx.kv.get<string>(KIT_DONE)) === ctx.plugin.version) {
		return [
			{ type: "context", text: `Polls show on your site through the WB Polls site kit. After each plugin update, copy the kit for the new version again.` },
			{ type: "actions", elements: [guide, { type: "button", action_id: "kit_again", label: "Show the setup steps again" }] },
		];
	}
	return [
		{
			type: "banner",
			title: "Set up visitor pages",
			description:
				"Installing WB Polls adds this admin, not pages on your site. Polls show on your posts and pages through the WB Polls site kit. Until you copy it, no poll shows and the address below is your site's 404 page.",
			variant: "default",
		},
		{ type: "context", text: `From your site's root folder, run this command. It copies the kit for the version you have installed (${tag}) through a fresh private folder, and runs the script only if the download worked.` },
		{
			type: "code",
			language: "bash",
			code: kitCommand(tag),
		},
		{
			type: "actions",
			elements: [{ ...guide, label: "Copy it from the install guide on a phone" }],
		},
		{
			type: "fields",
			fields: [
				{ label: "My votes", value: "/account/votes" },
				{ label: "Polls", value: "On posts and pages" },
			],
		},
		{
			type: "actions",
			elements: [guide, { type: "button", action_id: "kit_done", label: "Visitor pages are set up", style: "primary" }],
		},
	];
}

/** One plain line when this host gives EmDash no visitor address, so guests cannot vote. */
function guestsOffBlocks(ctx: Ctx): BlockMap[] {
	const tag = `v${ctx.plugin.version}`;
	return [
		{
			type: "context",
			text: "Guests cannot vote on this site: your host does not tell EmDash the visitor's address. Members can still vote. To let guests vote, host on Cloudflare, or set trustedProxyHeaders to a header your proxy writes itself (the guide explains which).",
		},
		{
			type: "actions",
			elements: [
				{
					type: "link",
					label: "Guest voting in the install guide",
					target: { kind: "external", url: `${REPO_URL}/blob/${tag}/docs/website/getting-started/install.md#guest-voting` },
				},
			],
		},
	];
}

/** The polls list is the first admin screen: it carries the visitor pages card and the guest line. */
async function withSetup(ctx: Ctx, res: BlockResponse, guestsOff: boolean): Promise<BlockResponse> {
	const [first, ...rest] = res.blocks;
	if (first?.type !== "header" || first.text !== "Polls") return res;
	return { ...res, blocks: [first, ...(await kitBlocks(ctx)), ...(guestsOff ? guestsOffBlocks(ctx) : []), ...rest] };
}

export async function handleAdmin(input: unknown, ctx: Ctx, opts: { guestsOff?: boolean } = {}): Promise<BlockResponse> {
	return drawn(async () => withSetup(ctx, await routeAdmin(input, ctx), opts.guestsOff === true));
}

/**
 * Most admin actions write, then draw the next screen. If drawing fails after the write, the
 * answer must not turn into an error page: say what to do instead. Nothing here hides a failed
 * write, because the message never claims the action worked.
 */
export async function drawn(render: () => Promise<BlockResponse>): Promise<BlockResponse> {
	try {
		return await render();
	} catch {
		return {
			blocks: [
				{ type: "section", text: "This screen could not load. Reload the page to see where things stand." },
				{ type: "actions", elements: [link("Polls", "/polls")] },
			],
			toast: { message: "This screen could not load.", type: "error" },
		};
	}
}

async function routeAdmin(input: unknown, ctx: Ctx): Promise<BlockResponse> {
	const raw = asRecord(input);
	const type = asString(raw.type);
	const page = asString(raw.page);

	if (type === "block_action" && asString(raw.action_id) === "kit_again") {
		await ctx.kv.delete(KIT_DONE);
		return renderList(ctx);
	}
	if (type === "block_action" && asString(raw.action_id) === "kit_done") {
		await ctx.kv.set(KIT_DONE, ctx.plugin.version);
		return renderList(ctx, {}, { toast: { message: "Noted. The install guide link stays on this page.", type: "success" } });
	}

	if (type === "form_submit" && asString(raw.action_id).startsWith("save|")) {
		const { rev, id } = parseStamped(raw.action_id);
		return savePoll(ctx, { ...asRecord(raw.values), id, rev });
	}
	if (type === "form_submit" && asString(raw.action_id) === "find") {
		return renderList(ctx, { q: asString(asRecord(raw.values).q) });
	}
	if (type === "block_action" && asString(raw.action_id) === "poll_mod") {
		return moderate(ctx, raw.value);
	}
	if (type === "block_action" && asString(raw.action_id) === "delete_confirm") {
		return moderate(ctx, raw.value);
	}
	if (type === "block_action" && asString(raw.action_id) === "page") {
		const [dir = "", bound = "", ...rest] = asString(raw.value).split("|");
		const q = rest.join("|");
		// A search reads up to three pages of polls, so only a plain page leaves calls for upkeep.
		const spare = q ? 0 : UPKEEP;
		if (dir === "before") return renderList(ctx, { q, before: bound }, undefined, spare);
		if (dir === "after") return renderList(ctx, { q, after: bound }, undefined, spare);
		return renderList(ctx, { q }, undefined, spare);
	}

	if (asString(raw.widget) === "open" || page === "widget:open" || page.includes("widget:open")) {
		return renderOpenWidget(ctx);
	}
	if (page.includes("/edit") || page.endsWith("edit")) {
		return renderForm(ctx, asString(raw.id));
	}
	return renderList(ctx, {}, undefined, UPKEEP);
}
