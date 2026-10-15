export const PUBLIC_RATE_LIMIT_MESSAGE = "Rate limit exceeded";

/**
 * Per-principal ceiling for the public surface (user, organization, or OAuth
 * client). `principalId` must be namespaced by the caller so ids cannot collide.
 */
export async function principalWithinRateLimit(env: Env, principalId: string): Promise<boolean> {
	const { success } = await env.PUBLIC_API_RATE_LIMITER.limit({ key: `principal:${principalId}` });
	return success;
}
