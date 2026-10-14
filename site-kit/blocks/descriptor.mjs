export function pollsBlock() {
	return {
		id: "polls-block",
		version: "1.0.0",
		format: "native",
		entrypoint: "/src/polls-block/plugin.ts",
		componentsEntry: "/src/polls-block/components.ts",
	};
}
