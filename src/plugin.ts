import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { MEMBER } from "./core";
import { handleEditorPanel } from "./editor";
import { countOpenPolls, readPublicPoll, readSlot } from "./lib/polls";
import { handleBallot, handleBallotGuest, handleVote, handleVoteGuest } from "./vote";

const later = async () => ({ ok: false, error: { code: "UNAVAILABLE" } });

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
		mine: { permission: MEMBER, methods: ["GET", "DELETE"], handler: later },
		admin: {
			handler: async (routeCtx, ctx) => handleAdmin(routeCtx.input, ctx),
		},
		editor_poll: {
			handler: async (routeCtx, ctx) => handleEditorPanel(routeCtx, ctx),
		},
	},
};

export default plugin;
