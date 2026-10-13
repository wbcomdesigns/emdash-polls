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
import { openSite } from "./site";

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
				expect.objectContaining({ path: "/edit" }),
			]),
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
	it("renders Polls on both declared pages", async () => {
		const site = await openSite();
		dispose = site.dispose;
		for (const path of ["/polls", "/edit"]) {
			const page = await site.rt.admin.loadPage(path);
			expect(page.blocks).toEqual(
				expect.arrayContaining([expect.objectContaining({ type: "header", text: "Polls" })]),
			);
		}
	});
});
