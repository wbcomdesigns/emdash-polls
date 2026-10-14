import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { MEMBER } from "./core";
import { handleEditorPanel } from "./editor";
import { countOpenPolls, listPolls, readPublicPoll, readSlot } from "./lib/polls";
import { asRecord, asString } from "./util";
import { handleBallot, handleBallotGuest, handleMine, handleVote, handleVoteGuest } from "./vote";

const plugin: SandboxedPlugin = {
	routes: {
		health: {
			public: true,
			handler: async (_routeCtx, ctx) => ({
				ok: true,
				plugin: ctx.plugin.id,
				version: ctx.plugin.version,
				open: await countOpenPolls(ctx),
			}),
		},
		get: {
			public: true,
			methods: ["GET"],
			handler: async (routeCtx, ctx) => readPublicPoll(ctx, routeCtx.input),
		},
		slot: {
			public: true,
			methods: ["GET"],
			handler: async (routeCtx, ctx) => readSlot(ctx, routeCtx.input),
		},
		vote: {
			permission: MEMBER,
			methods: ["POST"],
			handler: async (routeCtx, ctx) => handleVote(routeCtx, ctx),
		},
		ballot: {
			permission: MEMBER,
			methods: ["GET"],
			handler: async (routeCtx, ctx) => handleBallot(routeCtx, ctx),
		},
		vote_guest: {
			public: true,
			methods: ["POST"],
			handler: async (routeCtx, ctx) => handleVoteGuest(routeCtx, ctx),
		},
		ballot_guest: {
			public: true,
			methods: ["GET"],
			handler: async (routeCtx, ctx) => handleBallotGuest(routeCtx, ctx),
		},
		mine: { permission: MEMBER, methods: ["GET", "DELETE"], handler: handleMine },
		admin: {
			handler: async (routeCtx, ctx) => handleAdmin(routeCtx.input, ctx),
		},
		questions: {
			handler: async (_routeCtx, ctx) => {
				const listed = await listPolls(ctx, { limit: 100 });
				return {
					items: listed.items.map((poll) => {
						const name = poll.question || "Untitled poll";
						return { id: name, name };
					}),
				};
			},
		},
		by_question: {
			public: true,
			methods: ["POST"],
			handler: async (routeCtx, ctx) => {
				const question = asString(asRecord(routeCtx.input).question);
				if (!question) return { id: "" };
				const listed = await listPolls(ctx, { q: question, limit: 25 });
				const match = listed.items.find((poll) => poll.question === question);
				return { id: match?.id ?? "" };
			},
		},
		editor_poll: {
			handler: async (routeCtx, ctx) => handleEditorPanel(routeCtx, ctx),
		},
	},
};

export default plugin;
