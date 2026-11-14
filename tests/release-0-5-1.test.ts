import { afterEach, describe, expect, it } from "vitest";

import manifest from "../emdash-plugin.jsonc?raw";
import { emptyPoll } from "../src/lib/polls";
import plugin from "../src/plugin";
import { POLLS } from "../src/lib/types";
import { assertBlocks } from "./block-check";
import { member, openSite, withPosts } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

const editor = member("eddie", 40);
const author = member("auth", 30);
const contributor = member("cora", 20);
const subscriber = member("sub", 10);

const poll = (overrides: Record<string, unknown> = {}) => ({
	...emptyPoll("2026-11-13T00:00:00.000Z"),
	question: "Tea or coffee?",
	options: [
		{ id: "tea", label: "Tea" },
		{ id: "coffee", label: "Coffee" },
	],
	status: "open",
	who: "anyone",
	...overrides,
});

type Site = Awaited<ReturnType<typeof openSite>>;
type Panel = Awaited<ReturnType<Site["rt"]["admin"]["loadEditorPanel"]>>;
const checked = (where: string, response: Panel) => {
	assertBlocks(`editor panel ${where}`, response, []);
	return response;
};

/** A published post owned by `owner`. */
async function ownedPost(site: Site, owner: { id: string }, slug: string): Promise<string> {
	const row = await site.rt.fixtures.content("posts", {
		data: { title: slug },
		slug,
		status: "published",
		authorId: owner.id,
	} as never);
	return row.id;
}

describe("0.5.1 Poll panel for Editors and Authors", () => {
	it("declares the panel route for Authors and up, keeps admin for site admins, and needs EmDash 1.2.0", () => {
		const routes = plugin.routes as Record<string, { permission?: string }>;
		expect(routes.editor_poll?.permission).toBe("content:edit_own");
		expect(routes.admin?.permission).toBe("plugins:manage");
		expect(manifest).toMatch(/"release":\s*\{\s*"requires":\s*\{\s*"env:emdash":\s*">=1\.2\.0"\s*\}/);
	});

	it("lets an Editor create, open and remove a poll on someone else's post", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		const as = { user: editor } as never;

		const empty = checked("load", await site.rt.admin.loadEditorPanel("poll", "posts", posts.live, as));
		expect(JSON.stringify(empty.blocks)).toContain("No poll on this page");

		const created = checked(
			"create",
			await site.rt.admin.submitEditorPanel(
				"poll",
				"posts",
				posts.live,
				"create",
				{ question: "Soup?", answer_1: "Yes", answer_2: "No", who: "anyone", position: "below", open_now: false },
				as,
			),
		);
		expect(created.toast).toMatchObject({ type: "success" });
		const opened = checked("open", await site.rt.admin.actEditorPanel("poll", "posts", posts.live, "open", as));
		expect(opened.toast?.message).toBe("Poll opened.");
		const removed = checked("remove", await site.rt.admin.actEditorPanel("poll", "posts", posts.live, "remove", as));
		expect(removed.toast).toMatchObject({ type: "success" });
	});

	it("lets an Editor move a poll that is attached elsewhere", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		await site.rt.fixtures.plugin.storage(POLLS, "p_site", poll({ attach: "site", attach_key: "" }));
		const moved = checked(
			"attach",
			await site.rt.admin.submitEditorPanel("poll", "posts", posts.live, "attach", { poll_id: "p_site" }, { user: editor } as never),
		);
		expect(moved.toast).toMatchObject({ type: "success" });
		expect(await site.rt.inspect.storage.get(POLLS, "p_site")).toMatchObject({ attach: "entry" });
	});

	it("lets an Author use the panel on their own post and take back a poll they made", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withPosts(site.rt);
		const mine = await ownedPost(site, author, "mine");
		await site.rt.fixtures.plugin.storage(POLLS, "p_free", poll({ question: "Free poll?", created_by: author.id }));
		const as = { user: author } as never;

		const load = checked("load", await site.rt.admin.loadEditorPanel("poll", "posts", mine, as));
		expect(JSON.stringify(load.blocks)).toContain("Free poll?");

		const took = checked("attach", await site.rt.admin.submitEditorPanel("poll", "posts", mine, "attach", { poll_id: "p_free" }, as));
		expect(took.toast).toMatchObject({ type: "success" });
		expect(await site.rt.inspect.storage.get(POLLS, "p_free")).toMatchObject({ attach: "entry", attach_key: `posts:${mine}` });

		const removed = checked("remove", await site.rt.admin.actEditorPanel("poll", "posts", mine, "remove", as));
		expect(removed.toast).toMatchObject({ type: "success" });
		const created = checked(
			"create",
			await site.rt.admin.submitEditorPanel(
				"poll",
				"posts",
				mine,
				"create",
				{ question: "Mine?", answer_1: "Yes", answer_2: "No", who: "anyone", position: "below" },
				as,
			),
		);
		expect(created.toast).toMatchObject({ type: "success" });
		const made = (await site.rt.inspect.storage.list<{ question: string; created_by: string }>(POLLS)).find((row) => row.data.question === "Mine?");
		expect(made?.data.created_by).toBe(author.id);
	});

	it("never lets an Author take another member's detached poll or one made in the admin", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withPosts(site.rt);
		const mine = await ownedPost(site, author, "mine");
		// Detached and closed, made by another author: taking it would let them reopen it.
		await site.rt.fixtures.plugin.storage(POLLS, "p_theirs", poll({ question: "Theirs?", status: "closed", created_by: "someone-else" }));
		await site.rt.fixtures.plugin.storage(POLLS, "p_admin", poll({ question: "Admin made?" }));
		const as = { user: author } as never;

		const load = JSON.stringify(checked("load", await site.rt.admin.loadEditorPanel("poll", "posts", mine, as)).blocks);
		expect(load).not.toContain('"value":"p_theirs"');
		expect(load).not.toContain('"value":"p_admin"');
		for (const id of ["p_theirs", "p_admin"]) {
			const refused = checked("attach", await site.rt.admin.submitEditorPanel("poll", "posts", mine, "attach", { poll_id: id }, as));
			expect(refused.toast).toMatchObject({ type: "error" });
		}
		expect(await site.rt.inspect.storage.get(POLLS, "p_theirs")).toMatchObject({ attach: "none", status: "closed" });
		expect(await site.rt.inspect.storage.get(POLLS, "p_admin")).toMatchObject({ attach: "none" });
	});

	it("never lets an Author pull a poll off another page or the whole site", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		const mine = await ownedPost(site, author, "mine");
		await site.rt.fixtures.plugin.storage(POLLS, "p_site", poll({ question: "Site poll?", attach: "site", attach_key: "" }));
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"p_other",
			poll({ question: "Other page?", attach: "entry", attach_key: `posts:${posts.live}` }),
		);
		const as = { user: author } as never;

		const load = JSON.stringify(checked("load", await site.rt.admin.loadEditorPanel("poll", "posts", mine, as)).blocks);
		expect(load).not.toContain('"value":"p_site"');
		expect(load).not.toContain('"value":"p_other"');

		for (const id of ["p_site", "p_other"]) {
			const refused = checked("attach", await site.rt.admin.submitEditorPanel("poll", "posts", mine, "attach", { poll_id: id }, as));
			expect(refused.toast).toMatchObject({ type: "error" });
		}
		expect(await site.rt.inspect.storage.get(POLLS, "p_site")).toMatchObject({ attach: "site" });
		expect(await site.rt.inspect.storage.get(POLLS, "p_other")).toMatchObject({ attach_key: `posts:${posts.live}` });
	});

	it("refuses an Author on someone else's post, and Contributors and Subscribers everywhere", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		const theirs = await ownedPost(site, contributor, "theirs");
		await expect(site.rt.admin.loadEditorPanel("poll", "posts", posts.live, { user: author } as never)).rejects.toThrow(/\(403\)/);
		await expect(site.rt.admin.loadEditorPanel("poll", "posts", theirs, { user: contributor } as never)).rejects.toThrow(/\(403\)/);
		await expect(site.rt.admin.loadEditorPanel("poll", "posts", posts.live, { user: subscriber } as never)).rejects.toThrow(/\(403\)/);
	});
});
