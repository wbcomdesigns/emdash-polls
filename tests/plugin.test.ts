import { afterEach, describe, expect, it } from "vitest";

import { createPluginTestHost } from "@emdash-cms/plugin-test";

import {
	effectiveStatus,
	emptyPoll,
	parsePoll,
	pollOptionKey,
	voteRowId,
	visitorWho,
} from "../src/lib/polls";
import { POLLS, VOTES } from "../src/lib/types";
import { admin, ana, openSite, withPosts } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

function samplePoll(overrides: Record<string, unknown> = {}) {
	return {
		...emptyPoll("2026-10-13T00:00:00.000Z"),
		question: "Which colour should we ship?",
		options: [
			{ id: "blue", label: "Blue" },
			{ id: "green", label: "Green" },
		],
		status: "open",
		...overrides,
	};
}

describe("manifest", () => {
	it("declares polls and votes with the scoped indexes, and both admin pages", async () => {
		const host = await createPluginTestHost();
		dispose = () => host.dispose();
		expect(host.manifest.storage).toMatchObject({
			polls: { indexes: expect.arrayContaining(["status", "createdAt", "attach_key"]) },
			votes: { indexes: expect.arrayContaining(["poll", "poll_option", "member_id"]) },
		});
		expect(host.manifest.admin?.pages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "/polls", label: "Polls" }),
				expect.objectContaining({ path: "/edit", label: "New poll" }),
			]),
		);
		expect(host.manifest.admin?.widgets).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: "open", title: "Open polls" })]),
		);
		expect(host.manifest.admin?.editorPanels).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: "poll", title: "Poll", route: "editor_poll" })]),
		);
		expect(host.manifest.capabilities ?? []).toEqual([]);
	});
});

describe("schema helpers", () => {
	it("keeps option ids stable and fills missing ones", () => {
		const poll = parsePoll({
			question: "Pick one",
			options: [{ id: "keep", label: "Keep" }, { label: "New" }, { id: "keep", label: "Dup" }],
		});
		expect(poll.options[0]).toEqual({ id: "keep", label: "Keep" });
		expect(poll.options[1]?.id).toMatch(/^o_/);
		expect(poll.options[2]?.id).toMatch(/^o_/);
		expect(new Set(poll.options.map((option) => option.id)).size).toBe(3);
	});

	it("builds vote row ids the way SCOPE.md describes", () => {
		expect(voteRowId("p1", "ana", "blue")).toBe("p1:ana:blue");
		expect(voteRowId("p1", visitorWho("abc"), "blue")).toBe("p1:v-abc:blue");
		expect(pollOptionKey("p1", "blue")).toBe("p1:blue");
	});

	it("opens a scheduled draft and closes a poll once its close time has passed", () => {
		const now = Date.parse("2026-10-13T12:00:00.000Z");
		expect(
			effectiveStatus(
				parsePoll({ status: "draft", opens_at: "2026-10-13T11:00:00.000Z" }),
				now,
			),
		).toBe("open");
		expect(
			effectiveStatus(
				parsePoll({ status: "open", closes_at: "2026-10-13T11:00:00.000Z" }),
				now,
			),
		).toBe("closed");
		expect(
			effectiveStatus(
				parsePoll({ status: "draft", opens_at: "2026-10-13T13:00:00.000Z" }),
				now,
			),
		).toBe("draft");
	});
});

describe("storage and health", () => {
	it("answers health with a zero open count on an empty site", async () => {
		const site = await openSite();
		dispose = site.dispose;
		expect(await site.call("health")).toMatchObject({ ok: true, open: 0 });
	});

	it("stores polls and votes, and counts only open polls", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const openPoll = samplePoll();
		const draft = samplePoll({
			question: "Later",
			status: "draft",
			createdAt: "2026-10-13T01:00:00.000Z",
		});
		await site.rt.fixtures.plugin.storage(POLLS, "poll_open", openPoll);
		await site.rt.fixtures.plugin.storage(POLLS, "poll_draft", draft);
		await site.rt.fixtures.plugin.storage(VOTES, voteRowId("poll_open", "ana", "blue"), {
			poll: "poll_open",
			poll_option: pollOptionKey("poll_open", "blue"),
			member_id: "ana",
			createdAt: "2026-10-13T02:00:00.000Z",
			visitor: "",
			member_name: "",
		});

		expect(await site.call("health")).toMatchObject({ ok: true, open: 1 });
		expect(await site.rt.inspect.storage.get(POLLS, "poll_open")).toMatchObject({
			question: "Which colour should we ship?",
			status: "open",
			who: "anyone",
			attach: "none",
		});
		expect(await site.rt.inspect.storage.get(VOTES, "poll_open:ana:blue")).toMatchObject({
			poll: "poll_open",
			poll_option: "poll_open:blue",
			member_id: "ana",
		});
		const listed = await site.rt.inspect.storage.list(POLLS);
		expect(listed.map((row) => row.id).sort()).toEqual(["poll_draft", "poll_open"]);
	});
});

describe("admin", () => {
	it("renders the empty list and the new-poll form", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const list = await site.rt.admin.loadPage("/polls");
		expect(list.blocks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "header", text: "Polls" }),
				expect.objectContaining({ type: "empty", title: "No polls yet" }),
			]),
		);
		const form = await site.rt.admin.loadPage("/edit");
		expect(form.blocks).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: "header", text: "New poll" })]),
		);
	});

	it("refuses a poll with one option", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const result = (await site.call(
			"admin",
			{
				type: "form_submit",
				action_id: "save||",
				values: { question: "Only one?", options: "Yes" },
			},
			site.as(admin),
		)) as { toast?: { message: string; type: string } };
		expect(result.toast).toMatchObject({ type: "error", message: "Add at least two answers." });
		expect(await site.rt.inspect.storage.list(POLLS)).toHaveLength(0);
	});

	it("creates, opens, closes and deletes a poll", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const created = (await site.call(
			"admin",
			{
				type: "form_submit",
				action_id: "save||",
				values: { question: "Which colour?", options: "Blue\nGreen", who: "anyone" },
			},
			site.as(admin),
		)) as { toast?: { message: string } };
		expect(created.toast?.message).toBe("Poll created.");
		const row = (
			await site.rt.inspect.storage.list<{
				question: string;
				status: string;
				rev: string;
				options: Array<{ id: string; label: string }>;
			}>(POLLS)
		)[0];
		expect(row.data).toMatchObject({ question: "Which colour?", status: "draft" });
		expect(row.data.options).toHaveLength(2);

		const opened = (await site.call(
			"admin",
			{ type: "block_action", action_id: "poll_mod", value: `open|${row.data.rev}|${row.id}` },
			site.as(admin),
		)) as { toast?: { message: string } };
		expect(opened.toast?.message).toBe("Poll opened.");
		const afterOpen = await site.rt.inspect.storage.get<{ status: string; rev: string }>(POLLS, row.id);
		expect(afterOpen?.status).toBe("open");

		const closed = (await site.call(
			"admin",
			{ type: "block_action", action_id: "poll_mod", value: `close|${afterOpen?.rev}|${row.id}` },
			site.as(admin),
		)) as { toast?: { message: string } };
		expect(closed.toast?.message).toBe("Poll closed.");
		expect((await site.rt.inspect.storage.get<{ status: string }>(POLLS, row.id))?.status).toBe("closed");

		const latest = await site.rt.inspect.storage.get<{ rev: string }>(POLLS, row.id);
		const asking = (await site.call(
			"admin",
			{ type: "block_action", action_id: "poll_mod", value: `delete|${latest?.rev}|${row.id}` },
			site.as(admin),
		)) as { blocks: Array<Record<string, unknown>> };
		expect(asking.blocks).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: "banner", title: "Delete this poll?" })]),
		);

		const deleted = (await site.call(
			"admin",
			{ type: "block_action", action_id: "delete_confirm", value: `delete_confirm|${latest?.rev}|${row.id}` },
			site.as(admin),
		)) as { toast?: { message: string } };
		expect(deleted.toast?.message).toBe("Poll deleted.");
		expect(await site.rt.inspect.storage.get(POLLS, row.id)).toBeNull();
	});

	it("locks answers once a poll has votes, and still allows wording fixes", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const poll = samplePoll({ rev: "r1" });
		await site.rt.fixtures.plugin.storage(POLLS, "poll_lock", poll);
		await site.rt.fixtures.plugin.storage(VOTES, "poll_lock:ana:blue", {
			poll: "poll_lock",
			poll_option: "poll_lock:blue",
			member_id: "ana",
			createdAt: "2026-10-13T02:00:00.000Z",
			visitor: "",
			member_name: "",
		});

		const refused = (await site.call(
			"admin",
			{
				type: "form_submit",
				action_id: "save|r1|poll_lock",
				values: { question: "Which colour should we ship?", options: "Blue\nGreen\nRed" },
			},
			site.as(admin),
		)) as { toast?: { message: string; type: string } };
		expect(refused.toast).toMatchObject({
			type: "error",
			message: "This poll has votes, so answers cannot be added or removed.",
		});

		const saved = (await site.call(
			"admin",
			{
				type: "form_submit",
				action_id: "save|r1|poll_lock",
				values: { question: "Which colour should we make?", options: "Navy\nForest" },
			},
			site.as(admin),
		)) as { toast?: { message: string } };
		expect(saved.toast?.message).toBe("Poll saved.");
		const updated = await site.rt.inspect.storage.get<{ question: string; options: Array<{ id: string; label: string }> }>(
			POLLS,
			"poll_lock",
		);
		expect(updated?.question).toBe("Which colour should we make?");
		expect(updated?.options).toEqual([
			{ id: "blue", label: "Navy" },
			{ id: "green", label: "Forest" },
		]);
	});

	it("renders the dashboard card of open polls", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_open", samplePoll());
		const card = (await site.call("admin", { type: "page_load", page: "widget:open" }, site.as(admin))) as {
			blocks: Array<Record<string, unknown>>;
		};
		expect(JSON.stringify(card.blocks)).toContain("Which colour should we ship?");
	});
});

describe("editing-screen panel", () => {
	it("loads on a saved post, creates a poll here, then removes it", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);

		const empty = await site.rt.admin.loadEditorPanel("poll", "posts", posts.live);
		expect(empty.blocks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "header", text: "Poll" }),
				expect.objectContaining({ type: "empty", title: "No poll on this page" }),
			]),
		);

		const created = await site.rt.admin.submitEditorPanel("poll", "posts", posts.live, "create", {
			question: "Soup or salad?",
			options: "Soup\nSalad",
			who: "anyone",
			position: "below",
		});
		expect(created.toast).toMatchObject({ type: "success" });
		expect(JSON.stringify(created.blocks)).toContain("Soup or salad?");

		const stored = await site.rt.inspect.storage.list<{ question: string; attach: string; attach_key: string }>(POLLS);
		expect(stored).toHaveLength(1);
		expect(stored[0]?.data).toMatchObject({
			question: "Soup or salad?",
			attach: "entry",
			attach_key: `posts:${posts.live}`,
		});

		const removed = await site.rt.admin.actEditorPanel("poll", "posts", posts.live, "remove");
		expect(removed.toast).toMatchObject({ type: "success" });
		expect(removed.blocks).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: "empty", title: "No poll on this page" })]),
		);
		expect((await site.rt.inspect.storage.get<{ attach: string }>(POLLS, stored[0]?.id ?? ""))?.attach).toBe("none");
	});

	it("attaches an existing poll by question, not by a typed id", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		await site.rt.fixtures.plugin.storage(POLLS, "poll_ready", samplePoll({ rev: "r-panel" }));

		const attached = await site.rt.admin.submitEditorPanel("poll", "posts", posts.live, "attach", {
			poll_id: "poll_ready",
		});
		expect(attached.toast).toMatchObject({ type: "success" });
		expect(JSON.stringify(attached.blocks)).toContain("Which colour should we ship?");
		expect(await site.rt.inspect.storage.get(POLLS, "poll_ready")).toMatchObject({
			attach: "entry",
			attach_key: `posts:${posts.live}`,
		});
	});

	it("refuses guests and members on the panel route", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const guest = await site.rt.actions.routes.request("editor_poll", { method: "POST", body: { type: "panel_load" } });
		expect(guest.status).toBe(401);
		const member = await site.rt.actions.routes.request("editor_poll", {
			method: "POST",
			body: { type: "panel_load" },
			user: ana,
		});
		expect(member.status).toBe(403);
	});
});
