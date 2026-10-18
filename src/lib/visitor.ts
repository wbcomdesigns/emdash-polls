import type { PluginContext } from "emdash/plugin";

import { guestKey } from "../visitor-key";

type Ctx = Pick<PluginContext, "kv">;

const SALT = "visitor-salt";

async function sha256(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function salt(ctx: Ctx): Promise<string | null> {
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const seen = await ctx.kv.getVersioned<string>(SALT);
		if (seen?.value) return seen.value;
		const next = crypto.randomUUID();
		if ((await ctx.kv.compareAndSet(SALT, seen?.revision ?? null, next)).applied) return next;
	}
	// Never a one-off salt: a key nobody can produce again would let the same guest vote twice.
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

/** Salted hash of the guest's address, or null when the salt could not be read. Never the address itself. */
export async function visitorHash(ctx: Ctx, address: string): Promise<string | null> {
	const secret = await salt(ctx);
	return secret ? sha256(`${secret}|ip|${address}`) : null;
}
