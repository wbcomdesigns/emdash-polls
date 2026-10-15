import { describe, expect, it } from "vitest";

import block from "../site-kit/blocks/plugin.ts?raw";
import page from "../site-kit/blocks/PollBlock.astro?raw";
import manifest from "../emdash-plugin.jsonc?raw";

describe("in-text poll block", () => {
	it("stores the poll id, renders it with no server request, and the registry manifest has no block", () => {
		expect(block).toContain('label: "Poll"');
		expect(block).toContain('optionsRoute: "questions"');
		expect(block).toContain("callPluginRoute");
		expect(block).not.toContain("fetch(");
		expect(block).not.toContain("headers.get(\"cookie\")");
		expect(page).toContain("<Poll id={id} />");
		expect(page).not.toContain("fetch(");
		expect(page).not.toContain("Astro.url.origin");
		expect(manifest).not.toContain("portableTextBlocks");
	});
});
