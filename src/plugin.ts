import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { MEMBER } from "./core";
import { handleEditorPanel } from "./editor";
import { countOpenPolls, readPublicPoll, readSlot } from "./lib/polls";
import { requestAddress } from "./lib/visitor";
import { handleBallot, handleBallotGuest, handleMine, handleVote, handleVoteGuest } from "./vote";

// False when the host gives no visitor address: guests cannot vote here, so the kit shows sign-in.
const guestWrites = (routeCtx: { requestMeta?: unknown }) => requestAddress(routeCtx) !== null;
const withGuestWrites = <T extends object>(routeCtx: { requestMeta?: unknown }, result: T) =>
	"poll" in result && result.poll ? { ...result, guestWrites: guestWrites(routeCtx) } : result;

const plugin: SandboxedPlugin = {
	routes: {
		health: {
			public: true,
			handler: async (routeCtx, ctx) => ({
				ok: true,
				plugin: ctx.plugin.id,
				version: ctx.plugin.version,
				open: await countOpenPolls(ctx),
				guestWrites: guestWrites(routeCtx),
			}),
		},
		get: {
			public: true,
			methods: ["GET"],
			handler: async (routeCtx, ctx) => withGuestWrites(routeCtx, await readPublicPoll(ctx, routeCtx.input)),
		},
		slot: {
			public: true,
			methods: ["GET"],
			handler: async (routeCtx, ctx) => withGuestWrites(routeCtx, await readSlot(ctx, routeCtx.input)),
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
			handler: async (routeCtx, ctx) => handleAdmin(routeCtx.input, ctx, { guestsOff: !guestWrites(routeCtx) }),
		},
		editor_poll: {
			handler: async (routeCtx, ctx) => handleEditorPanel(routeCtx, ctx),
		},
	},
};

export default plugin;
