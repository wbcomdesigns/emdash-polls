import { definePlugin } from "emdash";

import { callPluginRoute } from "../lib/wbcom-kit";

/**
 * The insert dialog asks this route for the poll list. A native plugin route does not receive
 * Astro.locals, so callPluginRoute can run only when the host passed them. It never fetches
 * and it never sends the caller's session on. The public page does not call this: it renders the stored id.
 */
export function createPlugin() {
	return definePlugin({
		id: "polls-block",
		version: "1.0.0",
		routes: {
			questions: {
				handler: async (ctx) => {
					const locals = (ctx as { locals?: unknown }).locals;
					const result = await callPluginRoute(locals, "polls", "questions", {});
					const items = Array.isArray(result.items) ? result.items : [];
					return { items };
				},
			},
		},
		admin: {
			portableTextBlocks: [
				{
					type: "pollBlock",
					label: "Poll",
					description: "A poll inside this page. The list shows the question. The page stores the poll, so renaming the question does not remove it. The list is the first 100 polls.",
					fields: [
						{
							type: "select",
							action_id: "poll",
							label: "Poll",
							optionsRoute: "questions",
							options: [],
						},
					],
				},
			],
		},
	});
}

export default createPlugin;
