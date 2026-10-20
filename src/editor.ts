import type { PluginContext } from "emdash/plugin";

import { drawn, type BlockResponse } from "./admin";
import {
	answerFields,
	answersFromForm,
	applyOptionEdits,
	countVotes,
	createPoll,
	effectiveStatus,
	entryAttachKey,
	entryPublished,
	getPoll,
	listPolls,
	newId,
	newRev,
	parsePoll,
	pollForEntry,
	pollForSlot,
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

/** The panel, with one plain line first when the page is not published yet. */
async function renderPanel(
	ctx: Ctx,
	entry: { collection: string; id: string },
	extra?: Pick<BlockResponse, "toast">,
): Promise<BlockResponse> {
	const panel = await renderPanelBody(ctx, entry, extra);
	if (await entryPublished(ctx, entry.collection, entry.id)) return panel;
	return {
		...panel,
		blocks: [{ type: "context", text: "This page is not published yet. Its poll shows to visitors after you publish it." }, ...panel.blocks],
	};
}

async function renderPanelBody(
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
		// Nothing on this page itself, but a poll attached to the content type or the whole site may still show here.
		const shared = await pollForSlot(ctx, entry.collection, entry.id);
		const showing = shared && effectiveStatus(shared) !== "draft" ? shared : null;
		const where = showing?.attach === "site" ? "the whole site" : "every entry of this content type";
		return {
			blocks: [
				showing
					? {
							type: "section",
							text: `Visitors see "${showing.question}" here, because it is attached to ${where}. Attach a poll below to show a different one on this page only.`,
						}
					: {
							type: "section",
							text: "No poll on this page yet. Attach one, or create it below. Visitors see it once it is open.",
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
										initial_value: "",
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
						...answerFields([], false),
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
							label: "Position on the page",
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
		confirm: {
			title: "Remove this poll from the page?",
			text: "The poll itself stays in Polls. Only this page stops showing it.",
			confirm: "Remove",
			deny: "Keep it",
		},
	});
	return {
		blocks: [
			// The question goes in its own block: a fields cell cuts long text short in the narrow sidebar.
			{ type: "section", text: attached.question },
			{
				type: "fields",
				fields: [
					{ label: "Status", value: status },
					{ label: "Votes", value: String(votes) },
					{ label: "Position on the page", value: attached.position === "above" ? "Above the content" : "Below the content" },
					{ label: "Who can vote", value: attached.who === "members" ? "Members" : "Anyone" },
				],
			},
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
	const options = applyOptionEdits([], answersFromForm(values), false);
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
	await createPoll(ctx, newId("p"), poll);
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

export function handleEditorPanel(routeCtx: RouteCtx, ctx: Ctx): Promise<BlockResponse> {
	return drawn(() => routePanel(routeCtx, ctx));
}

async function routePanel(routeCtx: RouteCtx, ctx: Ctx): Promise<BlockResponse> {
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
