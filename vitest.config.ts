import { emdashPluginTest } from "@emdash-cms/plugin-test/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [emdashPluginTest()],
	// The first run after a clean install starts the runtime test host cold; 5 s timed out there.
	test: { testTimeout: 30_000 },
});
