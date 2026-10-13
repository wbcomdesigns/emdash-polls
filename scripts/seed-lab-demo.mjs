#!/usr/bin/env node
/** Create the three demo polls the lab page mounts. Lab-only. */
import { readFile, writeFile } from "node:fs/promises";

const base = process.env.BASE;
const jar = process.env.JAR;
const out = process.env.DEMO_IDS;
if (!base || !jar || !out) {
	console.error("BASE, JAR and DEMO_IDS are required");
	process.exit(1);
}

function cookieHeader(text) {
	return text
		.split("\n")
		.filter((line) => line && !line.startsWith("# "))
		.map((line) => line.replace(/^#HttpOnly_/, ""))
		.filter((line) => line && !line.startsWith("#"))
		.map((line) => {
			const parts = line.split("\t");
			return parts.length >= 7 ? `${parts[5]}=${parts[6]}` : "";
		})
		.filter(Boolean)
		.join("; ");
}

async function admin(body, cookie) {
	const response = await fetch(`${base}/_emdash/api/plugins/polls/admin`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-EmDash-Request": "1",
			Origin: base,
			Cookie: cookie,
		},
		body: JSON.stringify(body),
	});
	const json = await response.json();
	if (!response.ok) throw new Error(`admin ${response.status}: ${JSON.stringify(json)}`);
	return json.data ?? json;
}

function rowFor(blocks, question) {
	const table = (blocks ?? []).find((block) => block.type === "table" && Array.isArray(block.rows));
	const row = table?.rows?.find((item) => String(item.poll ?? "").includes(question));
	const edit = row?.action?.items?.find((item) => item.label === "Edit")?.value ?? "";
	const parts = String(edit).split("|");
	return { id: parts[2] ?? "", rev: parts[1] ?? "" };
}

const cookie = cookieHeader(await readFile(jar, "utf8"));

const specs = [
	{
		key: "single",
		values: {
			question: "Which colour should we ship?",
			options: "Blue\nGreen",
			who: "anyone",
			results: "always",
			attach: "site",
		},
		then: "open",
	},
	{
		key: "multi",
		values: {
			question: "Which extras do you want?",
			options: "Map\nComments\nSearch",
			multiple: true,
			who: "anyone",
			named: true,
			results: "always",
		},
		then: "open",
	},
	{
		key: "closed",
		values: {
			question: "Which name did we pick?",
			options: "Cedar\nWillow",
			who: "anyone",
			results: "always",
		},
		then: "close",
	},
];

const ids = { single: "", multi: "", closed: "" };

for (const spec of specs) {
	const created = await admin(
		{ type: "form_submit", action_id: "save||", values: spec.values },
		cookie,
	);
	if (created.toast?.type === "error") throw new Error(created.toast.message);
	const listed = await admin({ type: "page_load", page: "/polls" }, cookie);
	const row = rowFor(listed.blocks, spec.values.question);
	if (!row.id) throw new Error(`no row for ${spec.values.question}`);
	ids[spec.key] = row.id;
	if (spec.then === "open" || spec.then === "close") {
		const opened = await admin(
			{ type: "block_action", action_id: "poll_mod", value: `open|${row.rev}|${row.id}` },
			cookie,
		);
		if (opened.toast?.type === "error") throw new Error(opened.toast.message);
	}
	if (spec.then === "close") {
		const live = await admin({ type: "page_load", page: "/polls" }, cookie);
		const afterOpen = rowFor(live.blocks, spec.values.question);
		const closed = await admin(
			{
				type: "block_action",
				action_id: "poll_mod",
				value: `close|${afterOpen.rev}|${afterOpen.id}`,
			},
			cookie,
		);
		if (closed.toast?.type === "error") throw new Error(closed.toast.message);
	}
}

await writeFile(out, `${JSON.stringify(ids, null, "\t")}\n`);
console.log(`seeded demo polls ${JSON.stringify(ids)}`);
