import { afterEach, describe, expect, it } from "vitest";

import { openSite } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

describe("polls", () => {
	it("answers health and renders the admin page", async () => {
		const site = await openSite();
		dispose = site.dispose;
		expect(await site.call("health")).toMatchObject({ ok: true });
		const page = await site.rt.admin.loadPage("/polls");
		expect(page.blocks.length).toBeGreaterThan(0);
	});
});
