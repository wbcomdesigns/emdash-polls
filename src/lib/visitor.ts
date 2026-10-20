import type { PluginContext } from "emdash/plugin";

import { guestKey } from "../visitor-key";

type Ctx = Pick<PluginContext, "kv">;

const SALT = "visitor-salt";

async function sha256(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The site's salt and the bridge calls it took: one read, or two on the very first guest. */
async function salt(ctx: Ctx): Promise<{ value: string; calls: number } | null> {
	const seen = await ctx.kv.getVersioned<string>(SALT);
	if (seen?.value) return { value: seen.value, calls: 1 };
	const next = crypto.randomUUID();
	if ((await ctx.kv.compareAndSet(SALT, seen?.revision ?? null, next)).applied) return { value: next, calls: 2 };
	// Another guest created it at the same moment. Never a one-off salt: a key nobody can produce
	// again would let the same guest vote twice. The guest is asked to try again.
	return null;
}

/**
 * The visitor address EmDash passed in, reduced to one guest key (IPv6 by /64), or null. EmDash passes one only on
 * Cloudflare, or on a site that sets trustedProxyHeaders. With none, guests cannot write.
 */
export function requestAddress(routeCtx: { requestMeta?: unknown }): string | null {
	const ip = (routeCtx.requestMeta as { ip?: unknown } | undefined)?.ip;
	// guestKey returns null for anything it cannot parse: treated exactly like no address.
	return typeof ip === "string" ? guestKey(ip) : null;
}

/** Salted hash of the guest's address (never the address itself) and the calls it took, or null when the salt could not be read. */
export async function visitorHash(ctx: Ctx, address: string): Promise<{ hash: string; calls: number } | null> {
	const secret = await salt(ctx);
	return secret ? { hash: await sha256(`${secret.value}|ip|${address}`), calls: secret.calls } : null;
}
