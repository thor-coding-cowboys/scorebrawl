import type { JSONWebKeySet } from "jose";
import type { getDb } from "../db";
import { jwks as jwksTable } from "../db/schema/auth-schema";

type Db = ReturnType<typeof getDb>;

/** Better Auth keeps a rotated key verifiable for this long after `expiresAt`. */
const KEY_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * In-process public JWK set used to verify access tokens. The resource server and
 * the OAuth provider are the same Worker on two custom domains, and Cloudflare
 * refuses a Worker's fetch to itself, so verification must not GET `/api/auth/jwks`.
 */
export function createInProcessJwks(db: Db) {
	return async (): Promise<JSONWebKeySet> => {
		const keys = await db
			.select({
				id: jwksTable.id,
				publicKey: jwksTable.publicKey,
				alg: jwksTable.alg,
				crv: jwksTable.crv,
				expiresAt: jwksTable.expiresAt,
			})
			.from(jwksTable);

		const cutoff = Date.now() - KEY_GRACE_PERIOD_MS;
		return {
			keys: keys
				.filter((key) => !key.expiresAt || key.expiresAt.getTime() > cutoff)
				.map((key) => ({
					alg: key.alg ?? "EdDSA",
					...(key.crv ? { crv: key.crv } : {}),
					...JSON.parse(key.publicKey),
					kid: key.id,
				})),
		};
	};
}
