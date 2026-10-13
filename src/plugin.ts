import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { MEMBER } from "./core";
import { handleEditorPanel } from "./editor";
import { countOpenPolls, readPublicPoll } from "./lib/polls";

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
		vote: { permission: MEMBER, methods: ["POST"], handler: later },
		ballot: { permission: MEMBER, methods: ["GET"], handler: later },
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
