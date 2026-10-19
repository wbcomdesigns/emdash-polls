import { afterEach, describe, expect, it } from "vitest";

import { emptyPoll } from "../src/lib/polls";
import { POLLS } from "../src/lib/types";
import { admin, openSite, withPosts } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

const poll = (overrides: Record<string, unknown> = {}) => ({
	...emptyPoll("2026-10-13T00:00:00.000Z"),
	question: "Which colour should we ship?",
	options: [
		{ id: "blue", label: "Blue" },
		{ id: "green", label: "Green" },
	],
	status: "open",
	who: "anyone",
	...overrides,
});

type Slot = { ok: boolean; poll?: { question: string }; error?: unknown };
const slot = (site: Awaited<ReturnType<typeof openSite>>, collection: string, id: string) =>
	site.call("slot", { collection, id }, { method: "GET" }) as Promise<Slot>;

describe("a poll shows only on a published entry", () => {
	it("answers a draft like a page with no poll, for page, content type and whole-site polls", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		await site.rt.fixtures.plugin.storage(POLLS, "page", poll({ question: "Page?", attach: "entry", attach_key: `posts:${posts.draft}` }));
		expect(await slot(site, "posts", posts.draft)).toEqual({ ok: true });
		await site.rt.fixtures.plugin.storage(POLLS, "page", poll({ question: "Type?", attach: "collection", attach_key: "posts" }));
		expect(await slot(site, "posts", posts.draft)).toEqual({ ok: true });
		await site.rt.fixtures.plugin.storage(POLLS, "page", poll({ question: "Site?", attach: "site", attach_key: "" }));
		expect(await slot(site, "posts", posts.draft)).toEqual({ ok: true });
		expect((await slot(site, "posts", posts.live)).poll?.question).toBe("Site?");
	});

	it("shows after publish and hides again after unpublish", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		await site.rt.fixtures.plugin.storage(POLLS, "page", poll({ question: "Page?", attach: "entry", attach_key: `posts:${posts.draft}` }));
		expect((await slot(site, "posts", posts.draft)).poll).toBeUndefined();
		await site.rt.actions.content.publish("posts", posts.draft);
		expect((await slot(site, "posts", posts.draft)).poll?.question).toBe("Page?");
		await site.rt.actions.content.unpublish("posts", posts.draft);
		expect(await slot(site, "posts", posts.draft)).toEqual({ ok: true });
	});

	it("answers a missing entry and a missing content type with the same empty answer, never an error", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withPosts(site.rt);
		await site.rt.fixtures.plugin.storage(POLLS, "site", poll({ question: "Site?", attach: "site", attach_key: "" }));
		expect(await slot(site, "posts", "01NOSUCHENTRY0000000000000")).toEqual({ ok: true });
		expect(await slot(site, "no_such_type", "01NOSUCHENTRY0000000000000")).toEqual({ ok: true });
		expect(await slot(site, "", "")).toEqual({ ok: true });
	});

	it("tells the owner on a draft's Poll panel that the poll shows after publishing", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		const draft = await site.rt.admin.loadEditorPanel("poll", "posts", posts.draft, { user: admin } as never);
		expect(JSON.stringify(draft.blocks)).toContain("Its poll shows to visitors after you publish it.");
		const live = await site.rt.admin.loadEditorPanel("poll", "posts", posts.live, { user: admin } as never);
		expect(JSON.stringify(live.blocks)).not.toContain("after you publish it");
	});
});
