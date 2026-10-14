import type { PluginContext } from "emdash/plugin";

import type { BlockResponse } from "./admin";
import {
	applyOptionEdits,
	attachLabel,
	countVotes,
	entryAttachKey,
	getPoll,
	listPolls,
	newId,
	newRev,
	parsePoll,
	pollForEntry,
	putPoll,
	statusLabel,
} from "./lib/polls";
import { asBoolean, asRecord, asString } from "./util";

type Ctx = PluginContext;
type RouteCtx = {
	input: unknown;
	ui?: { entry?: { collection: string; id: string } };
};

function entryOf(routeCtx: RouteCtx): { collection: string; id: string } | null {
	const entry = routeCtx.ui?.entry;
	if (!entry?.collection || !entry.id) return null;
	return { collection: entry.collection, id: entry.id };
}

async function renderPanel(
	ctx: Ctx,
	entry: { collection: string; id: string },
	extra?: Pick<BlockResponse, "toast">,
): Promise<BlockResponse> {
	const attached = await pollForEntry(ctx, entry.collection, entry.id);
	const others = (await listPolls(ctx, { limit: 25 })).items.filter((poll) => poll.id !== attached?.id);
	const pickOptions = others
		.filter((poll) => poll.question)
		.map((poll) => ({
			label: `${poll.question} (${statusLabel(poll)})`,
			value: poll.id,
		}));

	if (!attached) {
		return {
			blocks: [
				{
					type: "empty",
					title: "No poll here",
					description: "Attach one, or create it below. Visitors see it after it is open.",
				},
				...(pickOptions.length
					? [
							{
								type: "form",
								block_id: "pick",
								fields: [
									{
										type: "select",
										action_id: "poll_id",
										label: "Use an existing poll",
										placeholder: "Choose a poll",
										options: [{ label: "Choose a poll", value: "" }, ...pickOptions],
									},
								],
								submit: { action_id: "attach", label: "Attach poll" },
							} as const,
						]
					: []),
				{
					type: "form",
					block_id: "create",
					fields: [
						{ type: "text_input", action_id: "question", label: "Question" },
						{
							type: "text_input",
							action_id: "options",
							label: "Answers (one per line)",
							multiline: true,
						},
						{
							type: "select",
							action_id: "who",
							label: "Who can vote",
							initial_value: "anyone",
							options: [
								{ label: "Anyone", value: "anyone" },
								{ label: "Signed-in members only", value: "members" },
							],
						},
						{
							type: "select",
							action_id: "position",
							label: "Where it appears",
							initial_value: "below",
							options: [
								{ label: "Below the content", value: "below" },
								{ label: "Above the content", value: "above" },
							],
						},
						{
							type: "toggle",
							action_id: "open_now",
							label: "Open now so visitors can vote",
							initial_value: true,
						},
					],
					submit: { action_id: "create", label: "Create poll here" },
				},
			],
			toast: extra?.toast,
		};
	}

	const votes = await countVotes(ctx, attached.id);
	const status = statusLabel(attached);
	const actions: Array<Record<string, unknown>> = [];
	if (status !== "Open") {
		actions.push({ type: "button", label: "Open", action_id: "open" });
	}
	actions.push({
		type: "button",
		label: "Remove from this page",
		action_id: "remove",
		style: "danger",
		confirm: {
			title: "Remove this poll from the page?",
			text: "The poll itself stays in Polls. Only this page stops showing it.",
			confirm: "Remove",
			deny: "Keep it",
		},
	});
	return {
		blocks: [
			{
				type: "fields",
				fields: [
					{ label: "Question", value: attached.question },
					{ label: "Status", value: status },
					{ label: "Votes", value: String(votes) },
					{ label: "Where it appears", value: attached.position === "above" ? "Above the content" : "Below the content" },
					{ label: "Who can vote", value: attached.who === "members" ? "Members" : "Anyone" },
				],
			},
			{ type: "context", text: `Also listed as ${attachLabel(attached)}.` },
			{ type: "actions", elements: actions },
		],
		toast: extra?.toast,
	};
}

async function attachExisting(ctx: Ctx, entry: { collection: string; id: string }, pollId: string): Promise<BlockResponse> {
	if (!pollId) {
		return renderPanel(ctx, entry, { toast: { message: "Choose a poll.", type: "error" } });
	}
	const poll = await getPoll(ctx, pollId);
	if (!poll) {
		return renderPanel(ctx, entry, { toast: { message: "That poll is gone.", type: "error" } });
	}
	const applied = await ctx.storage.polls.updateIf(poll.id, {
		where: { rev: poll.rev },
		set: {
			attach: "entry",
			attach_key: entryAttachKey(entry.collection, entry.id),
			rev: newRev(),
		},
	});
	if (!applied.applied) {
		return renderPanel(ctx, entry, { toast: { message: "Someone else changed that poll. Try again.", type: "error" } });
	}
	return renderPanel(ctx, entry, { toast: { message: "Poll attached to this page.", type: "success" } });
}

async function createHere(ctx: Ctx, entry: { collection: string; id: string }, values: Record<string, unknown>): Promise<BlockResponse> {
	const question = asString(values.question);
	if (!question) {
		return renderPanel(ctx, entry, { toast: { message: "Write a question.", type: "error" } });
	}
	const options = applyOptionEdits([], asString(values.options), false);
	if (!options.ok) {
		return renderPanel(ctx, entry, { toast: { message: options.error, type: "error" } });
	}
	const openNow = values.open_now === undefined ? true : asBoolean(values.open_now);
	const poll = parsePoll({
		question,
		options: options.options,
		who: asString(values.who) || "anyone",
		position: asString(values.position) || "below",
		attach: "entry",
		attach_key: entryAttachKey(entry.collection, entry.id),
		status: openNow ? "open" : "draft",
	});
	await putPoll(ctx, newId("p"), poll);
	return renderPanel(ctx, entry, {
		toast: { message: openNow ? "Poll created and opened on this page." : "Poll created on this page.", type: "success" },
	});
}

async function openHere(ctx: Ctx, entry: { collection: string; id: string }): Promise<BlockResponse> {
	const poll = await pollForEntry(ctx, entry.collection, entry.id);
	if (!poll) {
		return renderPanel(ctx, entry, { toast: { message: "No poll on this page.", type: "info" } });
	}
	const applied = await ctx.storage.polls.updateIf(poll.id, {
		where: { rev: poll.rev },
		set: { status: "open", rev: newRev() },
	});
	if (!applied.applied) {
		return renderPanel(ctx, entry, { toast: { message: "Someone else changed that poll. Try again.", type: "error" } });
	}
	return renderPanel(ctx, entry, { toast: { message: "Poll opened.", type: "success" } });
}

async function removeHere(ctx: Ctx, entry: { collection: string; id: string }): Promise<BlockResponse> {
	const poll = await pollForEntry(ctx, entry.collection, entry.id);
	if (!poll) {
		return renderPanel(ctx, entry, { toast: { message: "No poll on this page.", type: "info" } });
	}
	const applied = await ctx.storage.polls.updateIf(poll.id, {
		where: { rev: poll.rev },
		set: { attach: "none", attach_key: "", rev: newRev() },
	});
	if (!applied.applied) {
		return renderPanel(ctx, entry, { toast: { message: "Someone else changed that poll. Try again.", type: "error" } });
	}
	return renderPanel(ctx, entry, { toast: { message: "Poll removed from this page.", type: "success" } });
}

export async function handleEditorPanel(routeCtx: RouteCtx, ctx: Ctx): Promise<BlockResponse> {
	const entry = entryOf(routeCtx);
	if (!entry) {
		return {
			blocks: [
				{
					type: "banner",
					variant: "error",
					title: "Save the page first",
					description: "The poll panel works on a saved post or page.",
				},
			],
		};
	}

	const raw = asRecord(routeCtx.input);
	const type = asString(raw.type);
	if (type === "form_submit" && asString(raw.action_id) === "attach") {
		return attachExisting(ctx, entry, asString(asRecord(raw.values).poll_id));
	}
	if (type === "form_submit" && asString(raw.action_id) === "create") {
		return createHere(ctx, entry, asRecord(raw.values));
	}
	if (type === "block_action" && asString(raw.action_id) === "remove") {
		return removeHere(ctx, entry);
	}
	if (type === "block_action" && asString(raw.action_id) === "open") {
		return openHere(ctx, entry);
	}
	return renderPanel(ctx, entry);
}
