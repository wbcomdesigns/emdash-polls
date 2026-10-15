import { describe, expect, it } from "vitest";

import block from "../site-kit/blocks/plugin.ts?raw";
import page from "../site-kit/blocks/PollBlock.astro?raw";
import manifest from "../emdash-plugin.jsonc?raw";

describe("in-text poll block", () => {
	it("shows this page's poll from the current entry, with no list and no server request", () => {
		expect(block).toContain('label: "This page\'s poll"');
		expect(block).toContain('label: "What to show"');
		expect(block).toContain('{ label: "This page\'s poll", value: "poll" }');
		expect(block).not.toContain("optionsRoute");
		expect(block).not.toContain("questions");
		expect(block).not.toContain("fetch(");
		expect(block).not.toContain("callPluginRoute");
		expect(page).toContain("resolveEmDashPath");
		expect(page).toContain("replace(/\\/$/, \"\")");
		expect(page).toContain("<Poll collection={resolved.collection} entry={id} />");
		expect(page).not.toContain("fetch(");
		expect(page).not.toContain("Astro.url.origin");
		expect(manifest).not.toContain("portableTextBlocks");
		expect(manifest).not.toContain("questions");
	});
});
