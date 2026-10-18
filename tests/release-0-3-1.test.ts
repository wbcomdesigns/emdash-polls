import { afterEach, describe, expect, it } from "vitest";

import { emptyPoll } from "../src/lib/polls";
import { guestAddress } from "../src/lib/visitor";
import { POLLS, VOTES } from "../src/lib/types";
import { admin, ana, openSite } from "./site";

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
		{ id: "red", label: "Red" },
	],
	status: "open",
	who: "anyone",
	...overrides,
});

const fromIp = (ip: string | null, method = "POST") => ({ method, meta: { ip, userAgent: null, referer: null, geo: null } });

describe("parallel votes (one voter, single choice)", () => {
	it("a member sending several votes at once ends with exactly one stored choice", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "race", poll());
		const picks = ["blue", "green", "red", "blue", "green", "red"];
		const results = (await Promise.all(
			picks.map((choice) => site.call("vote", { id: "race", choices: [choice] }, site.as(ana))),
		)) as Array<{ ok: boolean; error?: { code: string } }>;
		const rows = await site.rt.inspect.storage.list(VOTES);
		expect(rows).toHaveLength(1);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		// The others wait their turn and are refused: already voted, busy, or (the hourly limit's own
		// compare-and-set losing under the same burst) rate limited. None of them is stored.
		for (const r of results.filter((r) => !r.ok)) expect(["ALREADY_VOTED", "BUSY", "RATE_LIMITED"]).toContain(r.error?.code);
	});

	it("a guest sending several votes at once from one address ends with exactly one stored choice", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "race_guest", poll());
		const picks = ["blue", "green", "red", "green"];
		await Promise.all(
			picks.map((choice) => site.call("vote_guest", { id: "race_guest", choices: [choice] }, fromIp("203.0.113.7"))),
		);
		expect(await site.rt.inspect.storage.list(VOTES)).toHaveLength(1);
	});

	it("a member who may change their vote still ends with one choice after parallel changes", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "race_change", poll({ allow_change: true }));
		await Promise.all(
			["blue", "green", "red"].map((choice) => site.call("vote", { id: "race_change", choices: [choice] }, site.as(ana))),
		);
		expect(await site.rt.inspect.storage.list(VOTES)).toHaveLength(1);
	});
});

describe("guest writes need a visitor address", () => {
	it("refuses a guest vote when the host gives no address, and stores nothing", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "p", poll());
		for (const ip of [null, "", "unknown"]) {
			expect(
				await site.call("vote_guest", { id: "p", choices: ["blue"], visitor: "a".repeat(32) }, fromIp(ip)),
			).toMatchObject({ ok: false, error: { code: "GUEST_UNAVAILABLE" } });
		}
		expect(await site.rt.inspect.storage.list(VOTES)).toHaveLength(0);
	});

	it("health says guest writes are off with no address and on with one", async () => {
		const site = await openSite();
		dispose = site.dispose;
		expect(await site.call("health", {}, fromIp(null, "GET"))).toMatchObject({ ok: true, guestWrites: false });
		expect(await site.call("health", {}, fromIp("203.0.113.7", "GET"))).toMatchObject({ ok: true, guestWrites: true });
	});

	it("tells the poll reader whether a guest can vote here", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "p", poll());
		expect(await site.call("get", { id: "p" }, fromIp(null, "GET"))).toMatchObject({ ok: true, guestWrites: false });
		expect(await site.call("get", { id: "p" }, fromIp("203.0.113.7", "GET"))).toMatchObject({ ok: true, guestWrites: true });
	});

	it("an IPv4 guest votes once, and the hourly limit still holds", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "p", poll());
		expect(await site.call("vote_guest", { id: "p", choices: ["blue"] }, fromIp("203.0.113.7"))).toMatchObject({ ok: true });
		expect(await site.call("vote_guest", { id: "p", choices: ["green"] }, fromIp("203.0.113.7"))).toMatchObject({
			ok: false,
			error: { code: "ALREADY_VOTED" },
		});
		let last: unknown;
		for (let i = 0; i < 8; i += 1) {
			last = await site.call("vote_guest", { id: "p", choices: ["green"] }, fromIp("203.0.113.7"));
		}
		expect(last).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
		// A browser-sent visitor id never makes a new guest.
		expect(
			await site.call("vote_guest", { id: "p", choices: ["green"], visitor: "b".repeat(32) }, fromIp("203.0.113.7")),
		).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
		const rows = await site.rt.inspect.storage.list<{ visitor: string }>(VOTES);
		expect(rows).toHaveLength(1);
		expect(JSON.stringify(rows)).not.toContain("203.0.113.7");
	});

	it("two IPv6 addresses in one /64 are one guest", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await site.rt.fixtures.plugin.storage(POLLS, "p", poll());
		expect(await site.call("vote_guest", { id: "p", choices: ["blue"] }, fromIp("2001:db8:1:2::1"))).toMatchObject({ ok: true });
		expect(
			await site.call("vote_guest", { id: "p", choices: ["green"] }, fromIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd")),
		).toMatchObject({ ok: false, error: { code: "ALREADY_VOTED" } });
		expect(await site.call("vote_guest", { id: "p", choices: ["green"] }, fromIp("2001:db8:1:3::1"))).toMatchObject({ ok: true });
		expect(await site.rt.inspect.storage.list(VOTES)).toHaveLength(2);
	});

	it("reduces an address to the part that names one guest", () => {
		expect(guestAddress("203.0.113.7")).toBe("203.0.113.7");
		expect(guestAddress("::ffff:203.0.113.7")).toBe("203.0.113.7");
		expect(guestAddress("2001:DB8:1:2::1")).toBe("2001:db8:1:2::/64");
		expect(guestAddress("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
		expect(guestAddress("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
		expect(guestAddress(null)).toBeNull();
		expect(guestAddress("unknown")).toBeNull();
	});
});

describe("first admin screen", () => {
	const asAdmin = (ip: string | null) => ({ method: "POST", user: admin, meta: { ip, userAgent: null, referer: null, geo: null } });
	type Page = { blocks: Array<Record<string, unknown>>; toast?: { message: string } };

	it("shows the visitor pages card with the command for this version until the owner says it is done", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const first = (await site.call("admin", { type: "page_load", page: "/polls" }, asAdmin("203.0.113.7"))) as Page;
		const text = JSON.stringify(first.blocks);
		expect(first.blocks[0]).toMatchObject({ type: "header", text: "Polls" });
		expect(first.blocks[1]).toMatchObject({ type: "banner", title: "Set up visitor pages" });
		const code = first.blocks.find((b) => b.type === "code") as { code: string };
		expect(code.code).toMatch(
			/^kit="\$\(mktemp -d\)" && git clone --branch v\d+\.\d+\.\d+ --depth 1 https:\/\/github.com\/wbcomdesigns\/emdash-polls "\$kit\/emdash-polls" && "\$kit\/emdash-polls\/scripts\/add-to-site.sh" \.$/,
		);
		expect(text).not.toContain("/tmp/emdash-polls");
		expect(text).toContain("/account/votes");
		expect(text).toMatch(/blob\/v\d+\.\d+\.\d+\/docs\/website\/getting-started\/install\.md/);
		expect(text).not.toContain("Guests cannot vote");

		const done = (await site.call("admin", { type: "block_action", action_id: "kit_done" }, asAdmin("203.0.113.7"))) as Page;
		expect(done.toast?.message).toContain("install guide link stays");
		expect(JSON.stringify(done.blocks)).not.toContain("Set up visitor pages");
		expect(JSON.stringify(done.blocks)).toContain("Install guide");
		const again = (await site.call("admin", { type: "page_load", page: "/polls" }, asAdmin("203.0.113.7"))) as Page;
		expect(JSON.stringify(again.blocks)).not.toContain("Set up visitor pages");
	});

	it("says in one line that guests cannot vote when the host gives no visitor address", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const page = (await site.call("admin", { type: "page_load", page: "/polls" }, asAdmin(null))) as Page;
		const text = JSON.stringify(page.blocks);
		expect(text).toContain("Guests cannot vote on this site");
		expect(text).toContain("trustedProxyHeaders");
		expect(text).toContain("install.md#guest-voting");
		// Not on the poll form.
		const form = (await site.call("admin", { type: "page_load", page: "/edit" }, asAdmin(null))) as Page;
		expect(JSON.stringify(form.blocks)).not.toContain("Guests cannot vote");
	});
});
