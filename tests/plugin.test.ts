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
import { phrase } from "../site-kit/lib/polls-strings";
import { admin, ana, ben, openSite, withPosts } from "./site";

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

describe("wording", () => {
	it("maps route codes to phrases and never prints an unknown code", () => {
		expect(phrase("NOT_FOUND")).toBe("This poll is not available.");
		expect(phrase("ALREADY_VOTED")).toBe("You have already voted.");
		expect(phrase("nope")).toBe("Something went wrong. Try again.");
	});

	it("keeps visitor-facing kit phrases in the wording file", async () => {
		const { polls } = await import("../site-kit/lib/polls-strings");
		expect(polls.vote).toBe("Vote");
		expect(polls.change).toBe("Change vote");
		expect(polls.honeypot).toBe("company website");
		expect(phrase("FAILED")).toBe(polls.fallback);
	});
});

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

describe("public get", () => {
	it("returns NOT_FOUND for a missing id and for a draft", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_draft", samplePoll({ status: "draft" }));
		expect(await site.call("get", { id: "nope" }, { method: "GET" })).toEqual({
			ok: false,
			error: { code: "NOT_FOUND" },
		});
		expect(await site.call("get", { id: "poll_draft" }, { method: "GET" })).toEqual({
			ok: false,
			error: { code: "NOT_FOUND" },
		});
		expect(await site.call("get", { latest: "1" }, { method: "GET" })).toEqual({
			ok: false,
			error: { code: "NOT_FOUND" },
		});
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_never_opened",
			samplePoll({ status: "draft", closes_at: "2020-01-01T00:00:00.000Z" }),
		);
		expect(await site.call("get", { id: "poll_never_opened" }, { method: "GET" })).toEqual({
			ok: false,
			error: { code: "NOT_FOUND" },
		});
		expect(await site.rt.inspect.storage.get<{ status: string }>(POLLS, "poll_never_opened")).toMatchObject({
			status: "draft",
		});
	});

	it("returns question and options on a members-only poll, and hides after_vote results", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_members",
			samplePoll({ who: "members", results: "after_vote" }),
		);
		await site.rt.fixtures.plugin.storage(VOTES, "poll_members:ana:blue", {
			poll: "poll_members",
			poll_option: "poll_members:blue",
			member_id: "ana",
			createdAt: "2026-10-13T02:00:00.000Z",
			visitor: "",
			member_name: "",
		});
		const got = (await site.call("get", { id: "poll_members" }, { method: "GET" })) as {
			ok: boolean;
			poll: { question: string; who: string; status: string; options: Array<{ id: string }> };
			results?: unknown;
		};
		expect(got).toMatchObject({
			ok: true,
			poll: {
				question: "Which colour should we ship?",
				who: "members",
				status: "open",
				options: [
					{ id: "blue", label: "Blue" },
					{ id: "green", label: "Green" },
				],
			},
		});
		expect(got.results).toBeUndefined();
	});

	it("hides after_close results while open, then closes on read and shows them", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const openHidden = samplePoll({ results: "after_close", rev: "r-open" });
		await site.rt.fixtures.plugin.storage(POLLS, "poll_hidden", openHidden);
		const hidden = (await site.call("get", { id: "poll_hidden" }, { method: "GET" })) as { results?: unknown };
		expect(hidden.results).toBeUndefined();

		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_due",
			samplePoll({
				results: "after_close",
				closes_at: "2020-01-01T00:00:00.000Z",
				rev: "r-due",
			}),
		);
		await site.rt.fixtures.plugin.storage(VOTES, "poll_due:ana:blue", {
			poll: "poll_due",
			poll_option: "poll_due:blue",
			member_id: "ana",
			createdAt: "2026-10-13T02:00:00.000Z",
			visitor: "",
			member_name: "",
		});
		const closed = (await site.call("get", { id: "poll_due" }, { method: "GET" })) as {
			ok: boolean;
			poll: { status: string };
			results?: { total: number; options: Array<{ id: string; count: number; percent: number }> };
		};
		expect(closed).toMatchObject({
			ok: true,
			poll: { status: "closed" },
			results: {
				total: 1,
				options: [
					{ id: "blue", count: 1, percent: 100 },
					{ id: "green", count: 0, percent: 0 },
				],
			},
		});
		expect(await site.rt.inspect.storage.get<{ status: string }>(POLLS, "poll_due")).toMatchObject({
			status: "closed",
		});

		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_due_open",
			samplePoll({
				status: "draft",
				opens_at: "2020-01-01T00:00:00.000Z",
				rev: "r-open-due",
			}),
		);
		const opened = (await site.call("get", { id: "poll_due_open" }, { method: "GET" })) as {
			poll: { status: string };
		};
		expect(opened.poll.status).toBe("open");
		expect(await site.rt.inspect.storage.get<{ status: string }>(POLLS, "poll_due_open")).toMatchObject({
			status: "open",
		});
	});

	it("returns the newest still-open poll for latest, and skips one that just closed", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_old",
			samplePoll({
				question: "Older open",
				createdAt: "2026-10-12T00:00:00.000Z",
			}),
		);
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_expired",
			samplePoll({
				question: "Just closed",
				createdAt: "2026-10-14T00:00:00.000Z",
				closes_at: "2020-01-01T00:00:00.000Z",
			}),
		);
		const got = (await site.call("get", { latest: 1 }, { method: "GET" })) as {
			ok: boolean;
			poll: { id: string; question: string; status: string };
		};
		expect(got).toMatchObject({
			ok: true,
			poll: { id: "poll_old", question: "Older open", status: "open" },
		});
	});

	it("includes a tally when results are always visible", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_open", samplePoll({ results: "always" }));
		const got = (await site.call("get", { id: "poll_open" }, { method: "GET" })) as {
			results?: { total: number };
		};
		expect(got.results).toEqual({
			total: 0,
			options: [
				{ id: "blue", label: "Blue", count: 0, percent: 0 },
				{ id: "green", label: "Green", count: 0, percent: 0 },
			],
		});
	});

	it("refuses guests on vote, ballot and mine", async () => {
		const site = await openSite();
		dispose = site.dispose;
		expect((await site.rt.actions.routes.request("vote", { method: "POST" })).status).toBe(401);
		expect((await site.rt.actions.routes.request("ballot", { method: "GET" })).status).toBe(401);
		expect((await site.rt.actions.routes.request("mine", { method: "GET" })).status).toBe(401);
	});
});

describe("member vote", () => {
	it("saves one choice, ignores a forged member id, and hides after_vote results until they vote", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_vote",
			samplePoll({ results: "after_vote", thanks: "Thanks for voting." }),
		);

		const empty = (await site.call("ballot", { id: "poll_vote" }, { method: "GET", user: ana })) as {
			choices: string[];
			results?: unknown;
		};
		expect(empty.choices).toEqual([]);
		expect(empty.results).toBeUndefined();

		const saved = (await site.call(
			"vote",
			{ id: "poll_vote", choices: ["blue"], member_id: "ben" },
			site.as(ana),
		)) as {
			ok: boolean;
			choices: string[];
			thanks?: string;
			results?: { total: number };
		};
		expect(saved).toMatchObject({
			ok: true,
			choices: ["blue"],
			thanks: "Thanks for voting.",
			results: { total: 1 },
		});
		expect(await site.rt.inspect.storage.get(VOTES, "poll_vote:ana:blue")).toMatchObject({
			member_id: "ana",
			member_name: "",
			poll_option: "poll_vote:blue",
		});
		expect(await site.rt.inspect.storage.get(VOTES, "poll_vote:ben:blue")).toBeNull();
	});

	it("saves two choices on a multiple poll, then replaces them when change is allowed", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_multi",
			samplePoll({
				multiple: true,
				allow_change: true,
				options: [
					{ id: "blue", label: "Blue" },
					{ id: "green", label: "Green" },
					{ id: "red", label: "Red" },
				],
			}),
		);
		const first = (await site.call("vote", { id: "poll_multi", choices: ["blue", "green"] }, site.as(ana))) as {
			choices: string[];
		};
		expect(first.choices.sort()).toEqual(["blue", "green"]);
		const second = (await site.call("vote", { id: "poll_multi", choices: ["red"] }, site.as(ana))) as {
			choices: string[];
		};
		expect(second.choices).toEqual(["red"]);
		expect(await site.rt.inspect.storage.get(VOTES, "poll_multi:ana:blue")).toBeNull();
		expect(await site.rt.inspect.storage.get(VOTES, "poll_multi:ana:red")).toMatchObject({ member_id: "ana" });
	});

	it("refuses a second vote when change is off, a closed poll, and a foreign option id", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_once", samplePoll({ allow_change: false }));
		await site.call("vote", { id: "poll_once", choices: ["blue"] }, site.as(ana));
		expect(await site.call("vote", { id: "poll_once", choices: ["green"] }, site.as(ana))).toMatchObject({
			ok: false,
			error: { code: "ALREADY_VOTED" },
		});

		await site.rt.fixtures.plugin.storage(POLLS, "poll_shut", samplePoll({ status: "closed" }));
		expect(await site.call("vote", { id: "poll_shut", choices: ["blue"] }, site.as(ana))).toMatchObject({
			ok: false,
			error: { code: "NOT_OPEN" },
		});

		expect(await site.call("vote", { id: "poll_once", choices: ["from-elsewhere"] }, site.as(ben))).toMatchObject({
			ok: false,
			error: { code: "INVALID_CHOICE" },
		});
		expect(await site.call("vote", { id: "poll_once", choices: ["blue", "green"] }, site.as(ben))).toMatchObject({
			ok: false,
			error: { code: "INVALID_CHOICE" },
		});
	});

	it("stores the member name only on a named poll", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_named", samplePoll({ named: true }));
		await site.call("vote", { id: "poll_named", choices: ["green"] }, site.as(ana));
		expect(await site.rt.inspect.storage.get(VOTES, "poll_named:ana:green")).toMatchObject({
			member_id: "ana",
			member_name: "ana",
		});
	});
});

describe("guest vote", () => {
	const visitor = "a".repeat(32);

	it("saves one ballot per visitor and never stores an IP", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_guest", samplePoll({ who: "anyone" }));
		const saved = (await site.call("vote_guest", { id: "poll_guest", choices: ["blue"], visitor })) as {
			ok: boolean;
			choices: string[];
		};
		expect(saved).toMatchObject({ ok: true, choices: ["blue"] });
		const rows = await site.rt.inspect.storage.list<{
			member_id: string;
			visitor: string;
			member_name: string;
			poll: string;
		}>(VOTES);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.data).toMatchObject({ member_id: "", member_name: "", poll: "poll_guest" });
		expect(rows[0]?.data.visitor).toMatch(/^[a-f0-9]{64}$/);
		expect(rows[0]?.id.startsWith("poll_guest:v-")).toBe(true);

		expect(await site.call("vote_guest", { id: "poll_guest", choices: ["green"], visitor })).toMatchObject({
			ok: false,
			error: { code: "ALREADY_VOTED" },
		});
	});

	it("refuses a members-only poll, a honeypot, and a missing visitor", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_members", samplePoll({ who: "members" }));
		await site.rt.fixtures.plugin.storage(POLLS, "poll_open", samplePoll({ who: "anyone" }));
		expect(await site.call("vote_guest", { id: "poll_members", choices: ["blue"], visitor })).toMatchObject({
			ok: false,
			error: { code: "MEMBERS_ONLY" },
		});
		expect(
			await site.call("vote_guest", { id: "poll_open", choices: ["blue"], visitor, website: "https://spam.example" }),
		).toMatchObject({ ok: false, error: { code: "SPAM" } });
		expect(await site.call("vote_guest", { id: "poll_open", choices: ["blue"] })).toMatchObject({
			ok: false,
			error: { code: "NO_VISITOR" },
		});
	});

	it("stores no name when a guest votes on a named poll", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_named_guest", samplePoll({ named: true, who: "anyone" }));
		await site.call("vote_guest", { id: "poll_named_guest", choices: ["blue"], visitor });
		const rows = await site.rt.inspect.storage.list<{ member_name: string; visitor: string }>(VOTES);
		expect(rows[0]?.data.member_name).toBe("");
		expect(rows[0]?.data.visitor).toMatch(/^[a-f0-9]{64}$/);
	});
});

describe("slot", () => {
	it("returns the page poll, then the content-type poll, then the site poll, and skips closed", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const posts = await withPosts(site.rt);
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_site",
			samplePoll({ question: "Site?", attach: "site", attach_key: "", createdAt: "2026-01-01T00:00:00.000Z" }),
		);
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_type",
			samplePoll({
				question: "Posts?",
				attach: "collection",
				attach_key: "posts",
				createdAt: "2026-02-01T00:00:00.000Z",
			}),
		);
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_page",
			samplePoll({
				question: "This page?",
				attach: "entry",
				attach_key: `posts:${posts.live}`,
				createdAt: "2026-03-01T00:00:00.000Z",
			}),
		);
		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_closed",
			samplePoll({
				question: "Old page?",
				status: "closed",
				attach: "entry",
				attach_key: `posts:${posts.live}`,
				createdAt: "2026-04-01T00:00:00.000Z",
			}),
		);

		const page = (await site.call("slot", { collection: "posts", id: posts.live }, { method: "GET" })) as {
			ok: boolean;
			poll?: { question: string };
		};
		expect(page.poll?.question).toBe("This page?");

		const other = (await site.call("slot", { collection: "posts", id: "no-such" }, { method: "GET" })) as {
			poll?: { question: string };
		};
		expect(other.poll?.question).toBe("Posts?");

		const siteWide = (await site.call("slot", { collection: "pages", id: "home" }, { method: "GET" })) as {
			poll?: { question: string };
		};
		expect(siteWide.poll?.question).toBe("Site?");

		await site.rt.fixtures.plugin.storage(
			POLLS,
			"poll_site",
			samplePoll({ question: "Site?", attach: "site", attach_key: "", status: "closed" }),
		);
		const afterClose = (await site.call("slot", { collection: "pages", id: "home" }, { method: "GET" })) as {
			ok: boolean;
			poll?: unknown;
		};
		expect(afterClose.ok).toBe(true);
		expect(afterClose.poll).toBeUndefined();
	});
});

describe("named lock, copy, results, erase", () => {
	it("refuses switching a voted poll from anonymous to named", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_anon", samplePoll({ named: false, rev: "r-anon" }));
		await site.call("vote", { id: "poll_anon", choices: ["blue"] }, site.as(ana));
		const stored = await site.rt.inspect.storage.get<{ rev: string }>(POLLS, "poll_anon");
		const refused = (await site.call(
			"admin",
			{
				type: "form_submit",
				action_id: `save|${stored?.rev}|poll_anon`,
				values: { question: "Which colour should we ship?", options: "Blue\nGreen", named: true },
			},
			site.as(admin),
		)) as { toast?: { message: string } };
		expect(refused.toast?.message).toBe("This poll has votes, so anonymous or named is locked.");
	});

	it("copies a poll as a draft with new option ids and no votes", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_src", samplePoll({ rev: "r-src", named: true }));
		await site.call("vote", { id: "poll_src", choices: ["blue"] }, site.as(ana));
		const copied = (await site.call(
			"admin",
			{ type: "block_action", action_id: "poll_mod", value: "copy|r-src|poll_src" },
			site.as(admin),
		)) as { toast?: { message: string } };
		expect(copied.toast?.message).toBe("Poll copied. It is a draft.");
		const rows = await site.rt.inspect.storage.list<{
			question: string;
			status: string;
			named: boolean;
			options: Array<{ id: string }>;
		}>(POLLS);
		const copy = rows.find((row) => row.id !== "poll_src");
		expect(copy?.data.status).toBe("draft");
		expect(copy?.data.named).toBe(true);
		expect(copy?.data.question).toBe("Which colour should we ship? (copy)");
		expect(copy?.data.options[0]?.id).not.toBe("blue");
		const votes = await site.rt.inspect.storage.list(VOTES);
		expect(votes.every((row) => row.id.startsWith("poll_src:"))).toBe(true);
	});

	it("shows named members on results and can erase their votes", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_named", samplePoll({ named: true, rev: "r-n" }));
		await site.call("vote", { id: "poll_named", choices: ["green"] }, site.as(ana));
		const results = (await site.call(
			"admin",
			{ type: "block_action", action_id: "poll_mod", value: "results|r-n|poll_named" },
			site.as(admin),
		)) as { blocks: Array<Record<string, unknown>> };
		const text = JSON.stringify(results.blocks);
		expect(text).toContain("ana");
		expect(text).toContain("Green");
		expect(text).not.toMatch(/p_named|poll_named:ana/);

		const live = await site.rt.inspect.storage.get<{ rev: string }>(POLLS, "poll_named");
		const erased = (await site.call(
			"admin",
			{ type: "block_action", action_id: "poll_mod", value: `erase|${live?.rev}|poll_named|ana` },
			site.as(admin),
		)) as { toast?: { message: string } };
		expect(erased.toast?.message).toBe("Those votes were removed.");
		expect(await site.rt.inspect.storage.get(VOTES, "poll_named:ana:green")).toBeNull();
	});

	it("shows no names on anonymous results", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "poll_quiet", samplePoll({ named: false, rev: "r-q" }));
		await site.call("vote", { id: "poll_quiet", choices: ["blue"] }, site.as(ana));
		const results = (await site.call(
			"admin",
			{ type: "block_action", action_id: "poll_mod", value: "results|r-q|poll_quiet" },
			site.as(admin),
		)) as { blocks: Array<Record<string, unknown>> };
		expect(JSON.stringify(results.blocks)).not.toContain("ana");
		expect(JSON.stringify(results.blocks)).toContain("Anonymous");
	});
});
