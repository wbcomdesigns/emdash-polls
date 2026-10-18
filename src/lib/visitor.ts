import type { PluginContext } from "emdash/plugin";

type Ctx = Pick<PluginContext, "kv">;

const SALT = "visitor-salt";

async function sha256(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function salt(ctx: Ctx): Promise<string> {
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const seen = await ctx.kv.getVersioned<string>(SALT);
		if (seen?.value) return seen.value;
		const next = crypto.randomUUID();
		if ((await ctx.kv.compareAndSet(SALT, seen?.revision ?? null, next)).applied) return next;
	}
	return crypto.randomUUID();
}

/**
 * The address a guest is counted by, or null when the host gave none. An IPv6 visitor counts by
 * its /64 network, so rotating addresses inside one network is still one guest.
 */
export function guestAddress(value: unknown): string | null {
	const ip = (typeof value === "string" ? value.trim() : "").toLowerCase().replace(/%.*$/, "");
	if (!ip || ip === "unknown") return null;
	if (!ip.includes(":")) return ip;
	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
	if (mapped) return mapped[1] ?? null;
	const [head = "", tail = ""] = ip.split("::");
	const left = head ? head.split(":") : [];
	const right = ip.includes("::") && tail ? tail.split(":") : [];
	const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
	return `${groups
		.slice(0, 4)
		.map((group) => (Number.parseInt(group, 16) || 0).toString(16))
		.join(":")}::/64`;
}

/**
 * The visitor address EmDash passed in, reduced to one guest, or null. EmDash passes one only on
 * Cloudflare, or on a site that sets trustedProxyHeaders. With none, guests cannot write.
 */
export function requestAddress(routeCtx: { requestMeta?: unknown }): string | null {
	return guestAddress((routeCtx.requestMeta as { ip?: unknown } | undefined)?.ip);
}

/** Salted hash of the guest's address. Never the address itself. */
export async function visitorHash(ctx: Ctx, address: string): Promise<string> {
	return sha256(`${await salt(ctx)}|ip|${address}`);
}
