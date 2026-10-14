import { describe, expect, it } from "vitest";

import block from "../site-kit/blocks/plugin.ts?raw";
import manifest from "../emdash-plugin.jsonc?raw";

describe("in-text poll block", () => {
	it("picks a poll by its question, and the registry manifest has no block", () => {
		expect(block).toContain('label: "Poll"');
		expect(block).toContain('optionsRoute: "questions"');
		expect(block).not.toContain("action_id: \"id\"");
		expect(manifest).not.toContain("portableTextBlocks");
	});
});
