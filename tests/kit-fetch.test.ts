import { afterEach, describe, expect, it, vi } from "vitest";

import { pluginFetch, registryPluginId } from "../site-kit/lib/wbcom-kit";

const POLLS_REGISTRY_ID = "r_4dk64cimgjxrz74v";

const missing = () =>
	new Response(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Plugin route not found" } }), {
		status: 404,
	});
const ok = () => new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 });

async function fresh() {
	vi.resetModules();
	return (await import("../site-kit/lib/wbcom-kit")).pluginFetch as typeof pluginFetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("kit finds Polls routes on any install", () => {
	it("computes the registry id EmDash assigns this plugin", async () => {
		expect(await registryPluginId("polls")).toBe(POLLS_REGISTRY_ID);
	});

	it("uses the registry id on a registry install and remembers it", async () => {
		const call = await fresh();
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), url.includes(POLLS_REGISTRY_ID) ? ok() : missing()));
		expect((await call("polls", "health")).status).toBe(200);
		await call("polls", "health");
		expect(seen).toEqual([
			`/_emdash/api/plugins/${POLLS_REGISTRY_ID}/health`,
			`/_emdash/api/plugins/${POLLS_REGISTRY_ID}/health`,
		]);
	});

	it("falls back to the name on a local install", async () => {
		const call = await fresh();
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), url.includes("/polls/") ? ok() : missing()));
		expect((await call("polls", "health")).status).toBe(200);
		await call("polls", "health");
		expect(seen.at(-1)).toBe("/_emdash/api/plugins/polls/health");
		expect(seen).toHaveLength(3);
	});

	it("never remembers a failure, and forgets an address that stops answering", async () => {
		const call = await fresh();
		let up = false;
		const seen: string[] = [];
		vi.stubGlobal("fetch", async (url: string) => (seen.push(url), up && url.includes(POLLS_REGISTRY_ID) ? ok() : missing()));
		expect((await call("polls", "health")).status).toBe(404);
		up = true;
		expect((await call("polls", "health")).status).toBe(200);
		up = false;
		seen.length = 0;
		await call("polls", "health");
		expect(seen).toHaveLength(3);
	});

	it("keeps the plugin's own 404 instead of trying another address", async () => {
		const call = await fresh();
		const seen: string[] = [];
		vi.stubGlobal(
			"fetch",
			async (url: string) => (
				seen.push(url),
				new Response(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "This poll is not available." } }), {
					status: 404,
				})
			),
		);
		expect((await call("polls", "get?id=x")).status).toBe(404);
		expect(seen).toHaveLength(1);
	});
});
