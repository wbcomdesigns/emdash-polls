/**
 * Optional trusted companion for an in-text Poll block.
 * Registry (sandboxed) installs ignore this file. Do not import it from src/.
 */
import { definePlugin } from "emdash";
import type { PluginDescriptor } from "emdash";

const ID = "polls-block";
const VERSION = "0.1.0";

export function pollsBlock(): PluginDescriptor {
	return {
		id: ID,
		version: VERSION,
		entrypoint: "@wbcomdesigns/emdash-polls/trusted",
		componentsEntry: "@wbcomdesigns/emdash-polls/trusted/astro",
	};
}

export function createPlugin() {
	return definePlugin({
		id: ID,
		version: VERSION,
		admin: {
			portableTextBlocks: [
				{
					type: "wbPoll",
					label: "Poll",
					description: "Show the newest open poll in the article.",
					category: "Embeds",
				},
			],
		},
	});
}
