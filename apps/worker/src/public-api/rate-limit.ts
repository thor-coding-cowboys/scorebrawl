export const PUBLIC_RATE_LIMIT_MESSAGE = "Rate limit exceeded";

/**
 * Hashes a raw rate-limit principal (IP address, etc.) so callers never have to
 * store or log the raw value.
 */
export async function hashRateLimitKey(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Per-principal ceiling for the public surface (user, organization, or OAuth
 * client). `principalId` must be namespaced by the caller so ids cannot collide.
 */
export async function principalWithinRateLimit(env: Env, principalId: string): Promise<boolean> {
	const { success } = await env.PUBLIC_API_RATE_LIMITER.limit({ key: `principal:${principalId}` });
	return success;
}
