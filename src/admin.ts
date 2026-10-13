import type { PluginContext } from "emdash/plugin";

type Toast = { message: string; type: "success" | "error" | "info" };
export type BlockResponse = { blocks: Array<Record<string, unknown>>; toast?: Toast };

export async function handleAdmin(_input: unknown, _ctx: PluginContext): Promise<BlockResponse> {
	return {
		blocks: [
			{ type: "header", text: "Polls" },
			{
				type: "empty",
				title: "No polls yet",
				description: "Create a poll to ask a question and collect votes.",
			},
		],
	};
}
