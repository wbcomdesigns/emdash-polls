import { definePlugin } from "emdash";

export function createPlugin() {
	return definePlugin({
		id: "polls-block",
		version: "1.0.0",
		routes: {
			questions: {
				handler: async (ctx) => {
					const origin = new URL(ctx.request.url).origin;
					const res = await fetch(new URL("/_emdash/api/plugins/polls/questions", origin), {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-EmDash-Request": "1",
							cookie: ctx.request.headers.get("cookie") ?? "",
						},
						body: "{}",
					});
					const body = (await res.json().catch(() => ({}))) as {
						data?: { items?: Array<{ id: string; name: string }> };
						items?: Array<{ id: string; name: string }>;
					};
					return { items: body.data?.items ?? body.items ?? [] };
				},
			},
		},
		admin: {
			portableTextBlocks: [
				{
					type: "pollBlock",
					label: "Poll",
					description: "A poll inside this page",
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
