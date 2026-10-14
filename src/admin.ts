import type { PluginContext } from "emdash/plugin";

import {
	applyOptionEdits,
	attachLabel,
	ballotsFromVotes,
	copyPoll,
	countVotes,
	deleteVotesForMember,
	deleteVotesForPoll,
	emptyPoll,
	getPoll,
	hasVotes,
	listPolls,
	listVotesForPoll,
	newId,
	newRev,
	optionsToText,
	parsePoll,
	formTime,
	parseTimeField,
	splitTime,
	timeOptions,
	putPoll,
	statusLabel,
	tally,
} from "./lib/polls";
import { OPTIONS_MAX, OPTIONS_MIN, QUESTION_MAX, THANKS_MAX, type Poll } from "./lib/types";
import { asBoolean, asRecord, asString } from "./util";

type Toast = { message: string; type: "success" | "error" | "info" };
export type BlockMap = Record<string, unknown> & { type: string };
export type BlockResponse = { blocks: BlockMap[]; toast?: Toast };

type Ctx = PluginContext;
type Extra = Pick<BlockResponse, "toast">;
type SiteCollection = { slug: string; label: string };

/** Content types on the site, by their normal names. Hidden types stay out. */
async function siteCollections(ctx: Ctx): Promise<SiteCollection[]> {
	const found = (await ctx.schema?.listCollections()) ?? [];
	return found
		.filter((item) => !item.hidden)
		.map((item) => ({
			slug: item.slug,
			label: item.label || item.labelSingular || item.slug,
		}));
}

const PAGE = 25;

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

function displayStatus(poll: Poll): string {
	return statusLabel(poll);
}

export async function renderList(
	ctx: Ctx,
	opts: { q?: string; before?: string; after?: string } = {},
	extra?: Extra,
): Promise<BlockResponse> {
	const q = asString(opts.q);
	const listed = await listPolls(ctx, { q, before: opts.before, after: opts.after, limit: PAGE });
	const rows = await Promise.all(
		listed.items.map(async (poll) => {
			const votes = await countVotes(ctx, poll.id);
			const items: Array<{ label: string; value: string }> = [{ label: "Edit", value: stamped("edit", poll.id, poll.rev) }];
			if (displayStatus(poll) !== "Open") {
				items.push({ label: "Open", value: stamped("open", poll.id, poll.rev) });
			}
			if (displayStatus(poll) !== "Closed") {
				items.push({ label: "Close", value: stamped("close", poll.id, poll.rev) });
			}
			items.push({ label: "Results", value: stamped("results", poll.id, poll.rev) });
			items.push({ label: "Copy", value: stamped("copy", poll.id, poll.rev) });
			items.push({ label: "Delete", value: stamped("delete", poll.id, poll.rev) });
			const hidden =
				displayStatus(poll) === "Open" && (poll.attach === "site" || poll.attach === "collection")
					? " A more specific poll can hide this one."
					: "";
			return {
				poll: `${poll.question || "Untitled poll"}\n${
					poll.who === "members" ? "Members" : "Anyone"
				} · ${poll.named ? "Named" : "Anonymous"} · ${attachLabel(poll)} · ${votes} ${
					votes === 1 ? "vote" : "votes"
				}.${hidden}`,
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
		if (listed.hasOlder && listed.items[listed.items.length - 1]) {
			elements.push({
				type: "button",
				label: "Next",
				action_id: "page",
				value: `before|${listed.items[listed.items.length - 1]?.createdAt}|${q}`,
			});
		}
		if (elements.length) nav.push({ type: "actions", elements });
	}

	const body: BlockMap[] =
		rows.length === 0
			? [
					{
						type: "empty",
						title: q ? "No polls match that question" : "No polls yet",
						description: q
							? "Try a different search, or create a poll."
							: "Ask a question, add two or more answers, then open the poll.",
						actions: [link("Create a poll", "/edit")],
					},
				]
			: [
					{
						type: "table",
						page_action_id: "polls_page",
						columns: [
							{ key: "poll", label: "Poll" },
							{ key: "status", label: "Status" },
							{ key: "action", label: "Actions", format: "element" },
						],
						rows,
					},
					...nav,
				];

	return {
		blocks: [
			{ type: "header", text: "Polls" },
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
	const optionsText = asString(values.options) || optionsToText(poll.options);
	const lockedNote = voted
		? "This poll has votes. You can correct the question and the wording of an answer. You cannot add, remove or reorder answers, and you cannot switch between one choice and several."
		: `Write one answer per line. Use ${OPTIONS_MIN} to ${OPTIONS_MAX} answers.`;
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
			{ type: "context", text: lockedNote },
			{
				type: "form",
				block_id: "poll",
				fields: [
					{
						type: "text_input",
						action_id: "question",
						label: "Question",
						initial_value: question,
					},
					{
						type: "text_input",
						action_id: "options",
						label: "Answers (one per line)",
						multiline: true,
						initial_value: optionsText,
					},
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
					select("results", "When to show results", asString(values.results) || poll.results, [
						{ label: "Always", value: "always" },
						{ label: "After voting", value: "after_vote" },
						{ label: "After the poll closes", value: "after_close" },
					]),
					{
						type: "toggle",
						action_id: "allow_change",
						label: "Members may change their vote while the poll is open",
						initial_value: asBoolean(values.allow_change ?? poll.allow_change),
					},
					{
						type: "date_input",
						action_id: "opens_date",
						label: "Opens on (optional). A draft with a future day shows as Scheduled.",
						initial_value: "opens_date" in values ? asString(values.opens_date) : opensAt.date,
					},
					select("opens_time", "Opens at (UTC)", asString(values.opens_time) || opensAt.time, timeOptions(opensAt.time)),
					{
						type: "date_input",
						action_id: "closes_date",
						label: "Closes on (optional)",
						initial_value: "closes_date" in values ? asString(values.closes_date) : closesAt.date,
					},
					select("closes_time", "Closes at (UTC)", asString(values.closes_time) || closesAt.time, timeOptions(closesAt.time)),
					{
						type: "text_input",
						action_id: "thanks",
						label: "Thank-you line after voting (optional)",
						initial_value: asString(values.thanks) || poll.thanks,
					},
					select("attach", "Where it shows", asString(values.attach) || poll.attach, [
						{ label: "Not attached", value: "none" },
						{ label: "Whole site", value: "site" },
						{ label: "One content type", value: "collection" },
						...(poll.attach === "entry"
							? [{ label: "One page (set from the page editor)", value: "entry" }]
							: []),
					]),
					select("attach_key", "Content type. Needed for one content type.", currentType, typeOptions),
					select("position", "Position on the page", asString(values.position) || poll.position, [
						{ label: "Below the content", value: "below" },
						{ label: "Above the content", value: "above" },
					]),
					select("numbers", "Numbers visitors see", asString(values.numbers) || poll.numbers, [
						{ label: "Percent and count", value: "full" },
						{ label: "Percent only", value: "percent" },
					]),
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
	const found = await ctx.storage.polls.query({
		where: { status: "open" },
		orderBy: { createdAt: "desc" },
		limit: 8,
	});
	const open = found.items
		.map((item) => ({ id: item.id, ...parsePoll(item.data) }))
		.filter((poll) => displayStatus(poll) === "Open");
	if (open.length === 0) {
		return {
			blocks: [
				{ type: "section", text: "No open polls." },
				{ type: "actions", elements: [link("Polls", "/polls")] },
			],
		};
	}
	const rows = await Promise.all(
		open.map(async (poll) => ({
			question: poll.question,
			votes: String(await countVotes(ctx, poll.id)),
		})),
	);
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

async function renderResults(ctx: Ctx, poll: Poll & { id: string }, extra?: Extra): Promise<BlockResponse> {
	const results = await tally(ctx, poll);
	const votes = await listVotesForPoll(ctx, poll.id);
	const ballots = ballotsFromVotes(poll, votes);
	const namedRows = poll.named
		? ballots
				.filter((row) => row.who && !row.who.startsWith("v-"))
				.map((row) => ({
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
				}))
		: [];

	return {
		blocks: [
			{ type: "header", text: "Results" },
			{ type: "section", text: poll.question || "Untitled poll" },
			{
				type: "stats",
				items: [
					{ label: "Votes", value: String(results.total) },
					{ label: "Answers", value: String(results.options.length) },
					{ label: "Status", value: displayStatus(poll) },
				],
			},
			{
				type: "context",
				text: poll.named
					? "Named: each signed-in member and their choice. Guests stay anonymous."
					: "Anonymous: totals only. Names are not stored.",
			},
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
			},
			{ type: "context", text: `${results.total} ${results.total === 1 ? "vote" : "votes"} in total.` },
			...(poll.named
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
						]
					: [{ type: "empty", title: "No named votes yet", description: "Totals above still count guest votes." } as BlockMap]
				: []),
			{ type: "actions", elements: [link("Back to polls", "/polls")] },
		],
		toast: extra?.toast,
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
	const options = applyOptionEdits(existing?.options ?? [], asString(values.options), voted);
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

	await putPoll(ctx, pollId, next);
	return renderList(ctx, {}, { toast: { message: "Poll created.", type: "success" } });
}

async function moderate(ctx: Ctx, value: unknown): Promise<BlockResponse> {
	const { action, rev, id } = parseStamped(value);
	const poll = await getPoll(ctx, id);
	const stale = statusError(poll, rev);
	if (stale) return renderList(ctx, {}, { toast: { message: stale, type: "error" } });
	if (!poll) return renderList(ctx, {}, { toast: { message: "That poll is gone.", type: "error" } });

	if (action === "edit") return renderForm(ctx, poll.id);
	if (action === "results") return renderResults(ctx, poll);
	if (action === "copy") {
		const copyId = newId("p");
		await putPoll(ctx, copyId, copyPoll(poll));
		return renderForm(ctx, copyId, {
			toast: { message: "Rename this copy, then open it.", type: "success" },
		});
	}
	if (action === "erase") {
		const memberId = extraOf(value);
		if (!memberId) {
			return renderResults(ctx, poll, { toast: { message: "Pick a member to remove.", type: "error" } });
		}
		const removed = await deleteVotesForMember(ctx, poll.id, memberId);
		return renderResults(ctx, (await getPoll(ctx, poll.id)) ?? poll, {
			toast: {
				message: removed ? "Those votes were removed." : "No votes to remove.",
				type: removed ? "success" : "info",
			},
		});
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
		const applied = await ctx.storage.polls.updateIf(poll.id, {
			where: { rev: poll.rev },
			set: { rev: `deleting:${poll.rev}` },
		});
		if (!applied.applied) {
			return renderList(ctx, {}, { toast: { message: "Someone else changed this poll. Open it again.", type: "error" } });
		}
		await deleteVotesForPoll(ctx, poll.id);
		await ctx.storage.polls.delete(poll.id);
		return renderList(ctx, {}, { toast: { message: "Poll deleted.", type: "success" } });
	}

	return renderList(ctx, {}, { toast: { message: "Unknown action.", type: "error" } });
}

export async function handleAdmin(input: unknown, ctx: Ctx): Promise<BlockResponse> {
	const raw = asRecord(input);
	const type = asString(raw.type);
	const page = asString(raw.page);

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
		if (dir === "before") return renderList(ctx, { q, before: bound });
		if (dir === "after") return renderList(ctx, { q, after: bound });
		return renderList(ctx, { q });
	}

	if (asString(raw.widget) === "open" || page === "widget:open" || page.includes("widget:open")) {
		return renderOpenWidget(ctx);
	}
	if (page.includes("/edit") || page.endsWith("edit")) {
		return renderForm(ctx, asString(raw.id));
	}
	return renderList(ctx);
}
