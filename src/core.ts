import type { PluginContext } from "emdash/plugin";

import { asRecord, asString } from "./util";

// Lowest signed-in role (subscriber). Private routes get a host-verified routeCtx.user.
// A public route never gets a user, and a member id in the request is never trusted.
export const MEMBER = "content:read";

export type Member = { id: string; name: string | null; role: number };

/**
 * Bridge calls one plugin call may make. On Cloudflare each route, admin action and panel call gets
 * 10 requests to the site (EmDash 1.3.1, not configurable); one is kept as headroom. Routes that
 * build counts or tidy up spend only what is left of this. tests/bridge-budget.test.ts checks it.
 */
export const MAX_CALLS = 9;

export const SIGN_IN = { ok: false, error: { code: "SIGN_IN_REQUIRED", message: "Sign in to continue." } };
export const RATE_LIMITED = {
	ok: false,
	error: { code: "RATE_LIMITED", message: "Too many requests. Try again in an hour." },
};

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;

export async function rateLimited(ctx: Pick<PluginContext, "kv">, who: string): Promise<boolean> {
	if (!who) return false;
	const key = `rate:${who}`;
	// Compare-and-set, so requests arriving together cannot each slip under the limit.
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const seen = await ctx.kv.getVersioned<string>(key);
		const [start, count] = (seen?.value || "0|0").split("|").map(Number);
		const now = Date.now();
		const fresh = now - start > RATE_WINDOW_MS;
		if (!fresh && count >= RATE_MAX) return true;
		const next = fresh ? `${now}|1` : `${start}|${count + 1}`;
		if ((await ctx.kv.compareAndSet(key, seen?.revision ?? null, next)).applied) return false;
	}
	return true;
}

export type EntryRef = { title: string; url: string; published: boolean };

export async function entryRef(ctx: PluginContext, collection: string, id: string): Promise<EntryRef | null> {
	const item = await ctx.content?.get?.(collection, id).catch(() => null);
	if (!item) return null;
	const published = item.status === "published";
	const url = published ? await ctx.content?.getPublicUrl?.(collection, id).catch(() => null) : null;
	return {
		title: asString(asRecord(item.data).title) || item.slug || id,
		url: url || "",
		published,
	};
}
