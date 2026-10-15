import { definePlugin } from "emdash";

/**
 * This page's poll. The owner attaches the poll from the post editor's Poll panel.
 * The block has one fixed choice, so it inserts without a list or a typed id.
 * The page looks up the current entry itself. This plugin has no route and does not fetch.
 */
export function createPlugin() {
	return definePlugin({
		id: "polls-block",
		version: "1.0.0",
		admin: {
			portableTextBlocks: [
				{
					type: "pollBlock",
					label: "This page's poll",
					description: "The poll attached to this page. Choose it by its question in the post editor's Poll panel.",
					fields: [
						{
							type: "select",
							action_id: "show",
							label: "What to show",
							initial_value: "poll",
							options: [{ label: "This page's poll", value: "poll" }],
						},
					],
				},
			],
		},
	});
}

export default createPlugin;
